import { Router, type Request, type Response } from "express";
import {
  and,
  asc,
  desc,
  eq,
  ilike,
  inArray,
  or,
  sql,
} from "drizzle-orm";
import { getAuth } from "@clerk/express";
import {
  db,
  profilesTable,
  servicePricingTypeEnum,
  servicePortfolioImagesTable,
  servicesTable,
  notificationsTable,
} from "@workspace/db";
import { z } from "zod";

const router = Router();

const listServicesQuerySchema = z.object({
  query: z.string().trim().max(120).optional(),
  category: z.string().trim().max(80).optional(),
  region: z.string().trim().max(120).optional(),
  city: z.string().trim().max(120).optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  withinKm: z.coerce.number().int().min(1).max(100).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
}).superRefine((query, ctx) => {
  if ((query.latitude === undefined) !== (query.longitude === undefined)) {
    ctx.addIssue({
      code: "custom",
      path: ["latitude"],
      message: "Latitude and longitude must be provided together",
    });
  }
  if (query.withinKm !== undefined && query.latitude === undefined) {
    ctx.addIssue({
      code: "custom",
      path: ["withinKm"],
      message: "Location is required to filter by distance",
    });
  }
});

const serviceImageUrlSchema = z.string().trim().max(2048).refine((value) => {
  if (/^\/api\/storage\/(?:r2-objects|local-objects)\/[0-9a-f-]{36}$/i.test(value)) {
    return true;
  }
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}, "Image URL must be an HTTP(S) URL or an Afrlance uploaded image path");

const createServiceBodySchema = z.object({
  title: z.string().trim().min(2).max(120),
  category: z.string().trim().min(1).max(80),
  description: z.string().trim().min(10).max(5000),
  pricingType: z.enum(servicePricingTypeEnum.enumValues),
  baseRate: z.number().positive().nullable().optional(),
  region: z.string().trim().min(1).max(120),
  city: z.string().trim().min(1).max(120),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  phoneNumber: z.string().trim().min(5).max(32),
  whatsappNumber: z.string().trim().min(5).max(32),
  portfolioImages: z.array(
    z.object({
      imageUrl: serviceImageUrlSchema,
      caption: z.string().trim().max(240).nullable().optional(),
    }),
  ).min(1).max(10),
})
  .superRefine((service, ctx) => {
    if (service.pricingType === "contact_for_quote" && service.baseRate != null) {
      ctx.addIssue({
        code: "custom",
        path: ["baseRate"],
        message: "baseRate must be omitted for contact-for-quote services",
      });
    }
    if (service.pricingType !== "contact_for_quote" && service.baseRate == null) {
      ctx.addIssue({
        code: "custom",
        path: ["baseRate"],
        message: "baseRate is required for hourly and fixed services",
      });
    }
    if ((service.latitude == null) !== (service.longitude == null)) {
      ctx.addIssue({
        code: "custom",
        path: ["latitude"],
        message: "Latitude and longitude must be provided together",
      });
    }
  });

const serviceIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const updateServiceLocationBodySchema = z.object({
  latitude: z.number().min(-90).max(90).nullable(),
  longitude: z.number().min(-180).max(180).nullable(),
}).superRefine((location, ctx) => {
  if ((location.latitude === null) !== (location.longitude === null)) {
    ctx.addIssue({
      code: "custom",
      path: ["latitude"],
      message: "Latitude and longitude must both be provided or both be null",
    });
  }
});

export async function getServicesAction(req: Request, res: Response): Promise<void> {
  const parsed = listServicesQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { query, category, region, city, latitude, longitude, withinKm, limit, offset } = parsed.data;
  const conditions = [eq(profilesTable.isBlocked, false)];
  const rawDistanceKm = latitude === undefined || longitude === undefined
    ? null
    : sql<number>`6371 * 2 * asin(sqrt(least(1.0,
      power(sin(radians(${latitude} - ${servicesTable.latitude}) / 2), 2)
      + cos(radians(${servicesTable.latitude})) * cos(radians(${latitude}))
      * power(sin(radians(${longitude} - ${servicesTable.longitude}) / 2), 2)
    )))`;
  const roundedDistanceKm = rawDistanceKm
    ? sql<number>`round((${rawDistanceKm})::numeric)::double precision`
    : sql<number | null>`null`;
  if (category) conditions.push(eq(servicesTable.category, category));
  if (region) conditions.push(ilike(servicesTable.region, `%${region}%`));
  if (city) conditions.push(ilike(servicesTable.city, `%${city}%`));
  if (query) {
    conditions.push(
      or(
        ilike(servicesTable.title, `%${query}%`),
        ilike(servicesTable.description, `%${query}%`),
        ilike(servicesTable.category, `%${query}%`),
      )!,
    );
  }
  if (withinKm !== undefined && rawDistanceKm) {
    conditions.push(sql`${rawDistanceKm} <= ${withinKm}`);
  }
  const whereClause = conditions.length ? and(...conditions) : undefined;

  const [services, [{ count }]] = await Promise.all([
    db
      .select({
        id: servicesTable.id,
        userId: servicesTable.userId,
        title: servicesTable.title,
        category: servicesTable.category,
        description: servicesTable.description,
        pricingType: servicesTable.pricingType,
        baseRate: servicesTable.baseRate,
        region: servicesTable.region,
        city: servicesTable.city,
        distanceKm: roundedDistanceKm,
        phoneNumber: servicesTable.phoneNumber,
        whatsappNumber: servicesTable.whatsappNumber,
        isVerified: servicesTable.isVerified,
        createdAt: servicesTable.createdAt,
        providerName: profilesTable.name,
      })
      .from(servicesTable)
      .innerJoin(profilesTable, eq(servicesTable.userId, profilesTable.userId))
      .where(whereClause)
      .orderBy(
        ...(rawDistanceKm
          ? [sql`${rawDistanceKm} asc nulls last`, desc(servicesTable.createdAt), asc(servicesTable.id)]
          : [desc(servicesTable.createdAt), asc(servicesTable.id)]),
      )
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(servicesTable)
      .innerJoin(profilesTable, eq(servicesTable.userId, profilesTable.userId))
      .where(whereClause),
  ]);

  const images = services.length
    ? await db
      .select()
      .from(servicePortfolioImagesTable)
      .where(inArray(servicePortfolioImagesTable.serviceId, services.map((service) => service.id)))
      .orderBy(asc(servicePortfolioImagesTable.id))
    : [];
  const imagesByService = new Map<number, typeof images>();
  for (const image of images) {
    const serviceImages = imagesByService.get(image.serviceId) ?? [];
    serviceImages.push(image);
    imagesByService.set(image.serviceId, serviceImages);
  }

  res.json({
    services: services.map((service) => ({
      ...service,
      portfolioImages: imagesByService.get(service.id) ?? [],
    })),
    total: Number(count),
    limit,
    offset,
  });
}

export async function getServiceAction(req: Request, res: Response): Promise<void> {
  const params = serviceIdParamsSchema.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [service] = await db
    .select({
      id: servicesTable.id,
      userId: servicesTable.userId,
      title: servicesTable.title,
      category: servicesTable.category,
      description: servicesTable.description,
      pricingType: servicesTable.pricingType,
      baseRate: servicesTable.baseRate,
      region: servicesTable.region,
      city: servicesTable.city,
      phoneNumber: servicesTable.phoneNumber,
      whatsappNumber: servicesTable.whatsappNumber,
      isVerified: servicesTable.isVerified,
      createdAt: servicesTable.createdAt,
      providerName: profilesTable.name,
      providerAvatarUrl: profilesTable.avatarUrl,
      hasServiceLocation: sql<boolean>`${servicesTable.latitude} is not null and ${servicesTable.longitude} is not null`,
    })
    .from(servicesTable)
    .innerJoin(profilesTable, eq(servicesTable.userId, profilesTable.userId))
    .where(and(
      eq(servicesTable.id, params.data.id),
      eq(profilesTable.isBlocked, false),
    ));

  if (!service) {
    res.status(404).json({ error: "Service not found" });
    return;
  }

  const portfolioImages = await db
    .select()
    .from(servicePortfolioImagesTable)
    .where(eq(servicePortfolioImagesTable.serviceId, service.id))
    .orderBy(asc(servicePortfolioImagesTable.id));

  res.json({ ...service, portfolioImages });
}

export async function updateServiceLocationAction(req: Request, res: Response): Promise<void> {
  const userId = getAuth(req)?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const params = serviceIdParamsSchema.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = updateServiceLocationBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [updated] = await db
    .update(servicesTable)
    .set({
      latitude: parsed.data.latitude,
      longitude: parsed.data.longitude,
    })
    .where(and(
      eq(servicesTable.id, params.data.id),
      eq(servicesTable.userId, userId),
    ))
    .returning({ id: servicesTable.id });

  if (!updated) {
    res.status(404).json({ error: "Service not found" });
    return;
  }

  res.json({ hasServiceLocation: parsed.data.latitude !== null });
}

export async function getMyServicesAction(req: Request, res: Response): Promise<void> {
  const userId = getAuth(req)?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const services = await db
    .select({
      id: servicesTable.id,
      userId: servicesTable.userId,
      title: servicesTable.title,
      category: servicesTable.category,
      description: servicesTable.description,
      pricingType: servicesTable.pricingType,
      baseRate: servicesTable.baseRate,
      region: servicesTable.region,
      city: servicesTable.city,
      phoneNumber: servicesTable.phoneNumber,
      whatsappNumber: servicesTable.whatsappNumber,
      isVerified: servicesTable.isVerified,
      createdAt: servicesTable.createdAt,
      providerName: profilesTable.name,
      providerAvatarUrl: profilesTable.avatarUrl,
    })
    .from(servicesTable)
    .innerJoin(profilesTable, eq(servicesTable.userId, profilesTable.userId))
    .where(eq(servicesTable.userId, userId))
    .orderBy(desc(servicesTable.createdAt), asc(servicesTable.id));

  const images = services.length
    ? await db
      .select()
      .from(servicePortfolioImagesTable)
      .where(inArray(servicePortfolioImagesTable.serviceId, services.map((service) => service.id)))
      .orderBy(asc(servicePortfolioImagesTable.id))
    : [];
  const imagesByService = new Map<number, typeof images>();
  for (const image of images) {
    const serviceImages = imagesByService.get(image.serviceId) ?? [];
    serviceImages.push(image);
    imagesByService.set(image.serviceId, serviceImages);
  }

  res.json({
    services: services.map((service) => ({
      ...service,
      portfolioImages: imagesByService.get(service.id) ?? [],
    })),
    total: services.length,
    limit: services.length,
    offset: 0,
  });
}

export async function createServiceAction(
  req: Request,
  res: Response,
): Promise<void> {
  const userId = getAuth(req)?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const [profile] = await db
    .select({
      id: profilesTable.id,
      userId: profilesTable.userId,
      role: profilesTable.role,
      name: profilesTable.name,
      avatarUrl: profilesTable.avatarUrl,
      isBlocked: profilesTable.isBlocked,
      isVerified: profilesTable.isVerified,
    })
    .from(profilesTable)
    .where(eq(profilesTable.userId, userId));
  if (!profile) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }
  if (profile.isBlocked) {
    res.status(403).json({ error: "Blocked accounts cannot create service listings" });
    return;
  }
  if (profile.role !== "service_provider") {
    res.status(403).json({ error: "Only service providers can create services" });
    return;
  }

  const parsed = createServiceBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { portfolioImages, ...serviceValues } = parsed.data;
  const createdService = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(servicesTable)
      .values({ ...serviceValues, userId, isVerified: profile.isVerified })
      .returning();
    const images = portfolioImages.length
      ? await tx.insert(servicePortfolioImagesTable).values(
        portfolioImages.map((image) => ({
          serviceId: created.id,
          imageUrl: image.imageUrl,
          caption: image.caption ?? null,
        })),
      ).returning()
      : [];
    await tx.insert(notificationsTable).values({
      userId: profile.id,
      type: "service_listing_published",
      title: "Your service listing is live",
      body: `"${created.title}" is now published and visible in Local Services.`,
      relatedId: created.id,
      relatedType: "service",
    });
    return { service: created, portfolioImages: images };
  });

  res.status(201).json({
    service: {
      ...createdService.service,
      providerName: profile.name,
      providerAvatarUrl: profile.avatarUrl,
      portfolioImages: createdService.portfolioImages,
    },
  });
}

export async function deleteServiceAction(
  req: Request,
  res: Response,
): Promise<void> {
  const userId = getAuth(req)?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const params = serviceIdParamsSchema.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db
    .delete(servicesTable)
    .where(and(
      eq(servicesTable.id, params.data.id),
      eq(servicesTable.userId, userId),
    ))
    .returning({ id: servicesTable.id });
  if (!deleted) {
    res.status(404).json({ error: "Service not found" });
    return;
  }

  res.status(204).send();
}

router.get("/services", getServicesAction);
router.get("/services/my", getMyServicesAction);
router.get("/services/:id", getServiceAction);
router.patch("/services/:id/location", updateServiceLocationAction);
router.post("/services", createServiceAction);
router.delete("/services/:id", deleteServiceAction);

export default router;

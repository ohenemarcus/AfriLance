import { db, jobsTable, profilesTable } from "@workspace/db";

const freelancerProfiles = [
  {
    userId: "demo:freelancer-amara",
    name: "Amara Okafor",
    role: "freelancer",
    category: "Software Development",
    location: "Lagos, Nigeria",
    bio: "Full-stack developer building reliable web platforms for African startups and growing businesses.",
    skills: ["React", "Node.js", "PostgreSQL"],
    languages: ["English", "Igbo"],
    hourlyRate: 85,
    completedJobs: 28,
    avgRating: 4.9,
    totalReviews: 24,
    featured: true,
    isVerified: true,
    isTopRated: true,
  },
  {
    userId: "demo:freelancer-leila",
    name: "Leila Mensah",
    role: "freelancer",
    category: "Design & Creative",
    location: "Accra, Ghana",
    bio: "Brand designer creating memorable identities, digital products, and campaign experiences.",
    skills: ["Brand Identity", "Figma", "Illustration"],
    languages: ["English", "Twi"],
    hourlyRate: 68,
    completedJobs: 19,
    avgRating: 4.8,
    totalReviews: 17,
    featured: true,
    isVerified: true,
  },
  {
    userId: "demo:freelancer-kwame",
    name: "Kwame Badu",
    role: "freelancer",
    category: "Digital Marketing",
    location: "Kumasi, Ghana",
    bio: "Growth marketer focused on useful content, paid social, and measurable customer acquisition.",
    skills: ["SEO", "Content Strategy", "Meta Ads"],
    languages: ["English"],
    hourlyRate: 55,
    completedJobs: 34,
    avgRating: 4.7,
    totalReviews: 31,
    featured: true,
    isVerified: true,
  },
  {
    userId: "demo:freelancer-fatima",
    name: "Fatima Bello",
    role: "freelancer",
    category: "Data Science",
    location: "Abuja, Nigeria",
    bio: "Data analyst turning operational and customer data into clear decisions and useful dashboards.",
    skills: ["Python", "SQL", "Power BI"],
    languages: ["English", "Hausa"],
    hourlyRate: 72,
    completedJobs: 22,
    avgRating: 4.9,
    totalReviews: 20,
    featured: true,
    isVerified: true,
  },
  {
    userId: "demo:freelancer-thandi",
    name: "Thandiwe Dlamini",
    role: "freelancer",
    category: "Writing & Content",
    location: "Cape Town, South Africa",
    bio: "Long-form and UX writer helping companies explain complex products in a human, credible voice.",
    skills: ["UX Writing", "Copywriting", "Editorial"],
    languages: ["English", "Zulu"],
    hourlyRate: 48,
    completedJobs: 41,
    avgRating: 4.8,
    totalReviews: 36,
    featured: true,
    isVerified: true,
  },
];

const clientProfiles = [
  {
    userId: "demo:client-nova",
    name: "Nova Care Labs",
    role: "client",
    category: "Consulting",
    location: "Nairobi, Kenya",
    companyName: "Nova Care Labs",
    companySize: "11-50",
    industry: "Health Technology",
  },
  {
    userId: "demo:client-kente",
    name: "Kente Market",
    role: "client",
    category: "Business",
    location: "Accra, Ghana",
    companyName: "Kente Market",
    companySize: "2-10",
    industry: "E-commerce",
  },
  {
    userId: "demo:client-green",
    name: "GreenGrid Energy",
    role: "client",
    category: "Engineering & Architecture",
    location: "Lagos, Nigeria",
    companyName: "GreenGrid Energy",
    companySize: "51-200",
    industry: "Clean Energy",
  },
  {
    userId: "demo:client-lumina",
    name: "Lumina Learning",
    role: "client",
    category: "Education",
    location: "Johannesburg, South Africa",
    companyName: "Lumina Learning",
    companySize: "11-50",
    industry: "Education Technology",
  },
  {
    userId: "demo:client-moyo",
    name: "Moyo Finance",
    role: "client",
    category: "Finance & Accounting",
    location: "Nairobi, Kenya",
    companyName: "Moyo Finance",
    companySize: "51-200",
    industry: "Financial Services",
  },
];

async function insertMissingProfiles() {
  const userIds = [
    ...freelancerProfiles.map((profile) => profile.userId),
    ...clientProfiles.map((profile) => profile.userId),
  ];
  const existingProfiles = await db
    .select({ userId: profilesTable.userId })
    .from(profilesTable);
  const existingUserIds = new Set(
    existingProfiles.map((profile) => profile.userId),
  );
  const freelancerRowsToInsert = freelancerProfiles.filter(
    (profile) => !existingUserIds.has(profile.userId),
  );
  const clientRowsToInsert = clientProfiles.filter(
    (profile) => !existingUserIds.has(profile.userId),
  );

  const freelancerRows = freelancerRowsToInsert.length
    ? await db
        .insert(profilesTable)
        .values(freelancerRowsToInsert)
        .returning({ id: profilesTable.id, userId: profilesTable.userId })
    : [];
  const clientRows = clientRowsToInsert.length
    ? await db
        .insert(profilesTable)
        .values(clientRowsToInsert)
        .returning({ id: profilesTable.id, userId: profilesTable.userId })
    : [];
  const allRows = await db
    .select({ id: profilesTable.id, userId: profilesTable.userId })
    .from(profilesTable);

  return {
    freelancerRows,
    clientRows,
    allRows,
  };
}

async function seedMarketplace() {
  const { freelancerRows, clientRows, allRows } = await insertMissingProfiles();
  const clientIdByUser = new Map(allRows.map((row) => [row.userId, row.id]));

  const demoJobs = [
    {
      title: "[Demo] Build a patient appointment portal",
      description:
        "Nova Care Labs needs a responsive scheduling portal for patients and clinic staff, including availability, booking, reminders, and an accessible admin dashboard.",
      category: "Software Development",
      skills: ["React", "Node.js", "PostgreSQL"],
      budgetMin: 15000,
      budgetMax: 26000,
      budgetType: "fixed",
      location: "Nairobi, Kenya",
      remote: true,
      status: "open",
      clientId: clientIdByUser.get("demo:client-nova")!,
    },
    {
      title: "[Demo] Refresh an African market brand identity",
      description:
        "Create a distinctive identity system for Kente Market, including a logo, color system, typography, packaging direction, and social launch assets.",
      category: "Design & Creative",
      skills: ["Brand Identity", "Figma", "Packaging"],
      budgetMin: 6500,
      budgetMax: 12000,
      budgetType: "fixed",
      location: "Accra, Ghana",
      remote: true,
      status: "open",
      clientId: clientIdByUser.get("demo:client-kente")!,
    },
    {
      title: "[Demo] Plan a six-month clean-energy growth campaign",
      description:
        "Design and manage a focused campaign for commercial solar services, with landing-page direction, channel strategy, reporting, and monthly optimization.",
      category: "Digital Marketing",
      skills: ["Growth Strategy", "SEO", "Meta Ads"],
      budgetMin: 400,
      budgetMax: 650,
      budgetType: "hourly",
      location: "Lagos, Nigeria",
      remote: true,
      status: "open",
      clientId: clientIdByUser.get("demo:client-green")!,
    },
    {
      title: "[Demo] Build a student progress analytics dashboard",
      description:
        "Lumina Learning needs an executive dashboard that summarizes enrollment, attendance, learner progress, and at-risk cohorts from several course datasets.",
      category: "Data Science",
      skills: ["Python", "SQL", "Power BI"],
      budgetMin: 9000,
      budgetMax: 18000,
      budgetType: "fixed",
      location: "Johannesburg, South Africa",
      remote: true,
      status: "open",
      clientId: clientIdByUser.get("demo:client-lumina")!,
    },
    {
      title: "[Demo] Rewrite financial onboarding and help content",
      description:
        "Improve the language across Moyo Finance onboarding, loan explanations, notifications, and help-center articles while maintaining clarity and compliance.",
      category: "Writing & Content",
      skills: ["UX Writing", "Editing", "Fintech"],
      budgetMin: 7000,
      budgetMax: 14000,
      budgetType: "fixed",
      location: "Nairobi, Kenya",
      remote: true,
      status: "open",
      clientId: clientIdByUser.get("demo:client-moyo")!,
    },
  ];

  const existingTitles = await db
    .select({ title: jobsTable.title })
    .from(jobsTable);
  const titles = new Set(existingTitles.map((row) => row.title));
  const jobsToInsert = demoJobs.filter((job) => !titles.has(job.title));

  if (jobsToInsert.length > 0) {
    await db.insert(jobsTable).values(jobsToInsert);
  }

  console.log(
    `Seeded ${freelancerRows.length} demo freelancers and ${clientRows.length} demo clients.`,
  );
  console.log(
    `Inserted ${jobsToInsert.length} new demo jobs; ${demoJobs.length - jobsToInsert.length} already existed.`,
  );
}

await seedMarketplace();

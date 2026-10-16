import { clerkClient } from "@clerk/express";

const configuredAdminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();

export async function isAdminUser(userId: string): Promise<boolean> {
  if (!configuredAdminEmail) return false;

  try {
    const user = await clerkClient.users.getUser(userId);
    const primaryEmail = user.emailAddresses.find(
      (email) => email.id === user.primaryEmailAddressId,
    );

    return (
      primaryEmail?.verification?.status === "verified" &&
      primaryEmail.emailAddress.trim().toLowerCase() === configuredAdminEmail
    );
  } catch {
    return false;
  }
}
// app/actions/profile.ts
"use server";

import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/lib/authOptions";
import clientPromise from "@/app/lib/mongodb";
import { revalidatePath } from "next/cache";

// Define the shape of the user's profile data
export interface UserProfile {
  name: string;
  title: string;
  bio: string;
}

/**
 * Fetches the current user's profile from the database.
 * This function is now robust and guarantees a complete profile object
 * is returned if a user record is found, preventing type errors.
 */
export async function getUserProfile() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return null; // No user is logged in.
  }

  try {
    const client = await clientPromise;
    const db = client.db();
    const dataCollection = db.collection("data");

    const profile = await dataCollection.findOne({ userId: session.user.id });

    // If no profile exists yet in the DB for this user, return null.
    // The client component will handle this by showing an empty form.
    if (!profile) {
      return null;
    }

    // --- THIS IS THE FIX ---
    // We now explicitly construct the return object.
    // This guarantees that `name`, `title`, and `bio` will always be present,
    // using a default empty string ("") if the field is missing in the database.
    // This satisfies the type requirements of the SettingsClient component.
    return {
      _id: profile._id.toString(),
      userId: profile.userId.toString(),
      name: profile.name || "",
      title: profile.title || "",
      bio: profile.bio || "",
    };

  } catch (error) {
    console.error("Failed to fetch user profile:", error);
    return null;
  }
}

/**
 * Creates or updates a user's profile in the database.
 * This is an "upsert" operation.
 */
export async function updateUserProfile(profileData: UserProfile): Promise<{ success: boolean; error?: string }> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { success: false, error: "User not authenticated." };
  }

  try {
    const client = await clientPromise;
    const db = client.db();
    const dataCollection = db.collection("data");

    // Use updateOne with `upsert: true`.
    // This creates the document if it doesn't exist or updates it if it does.
    await dataCollection.updateOne(
      { userId: session.user.id }, // The filter to find the document
      { $set: { ...profileData, userId: session.user.id } }, // The data to set
      { upsert: true } // The upsert option
    );

    // Revalidate the /settings path to ensure the Server Component re-fetches the fresh data.
    revalidatePath("/settings");
    return { success: true };

  } catch (error) {
    console.error("Failed to update user profile:", error);
    const err = error as Error;
    return { success: false, error: err.message || "Database operation failed." };
  }
}

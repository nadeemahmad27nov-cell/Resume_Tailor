// app/actions/profile.ts
"use server";

import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/lib/authOptions"; // Assuming this path is correct
import clientPromise from "@/app/lib/mongodb";
import { revalidatePath } from "next/cache";

// Define the shape of the user's profile data
export interface UserProfile {
  name: string;
  title: string;
  bio: string;
}

// Action to get the current user's profile from the 'data' collection
export async function getUserProfile() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return null; // No user, no profile
  }

  try {
    const client = await clientPromise;
    const db = client.db();
    const dataCollection = db.collection("data");

    const profile = await dataCollection.findOne({ userId: session.user.id });

    if (!profile) {
      return null; // User exists but hasn't saved a profile yet
    }

    // --- THIS IS THE FIX ---
    // Instead of spreading `...profile`, we explicitly construct the object.
    // This guarantees that `name`, `title`, and `bio` will always be present,
    // even if they are just empty strings, which satisfies TypeScript.
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

// Action to create or update a user's profile (an "upsert" operation)
export async function updateUserProfile(profileData: UserProfile): Promise<{ success: boolean; error?: string }> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { success: false, error: "User not authenticated." };
  }

  try {
    const client = await clientPromise;
    const db = client.db();
    const dataCollection = db.collection("data");

    // Use updateOne with the 'upsert: true' option.
    await dataCollection.updateOne(
      { userId: session.user.id },
      { $set: { ...profileData, userId: session.user.id } },
      { upsert: true }
    );

    // Revalidate the path so the user sees the updated data.
    revalidatePath("/settings");
    return { success: true };

  } catch (error) {
    console.error("Failed to update user profile:", error);
    const err = error as Error;
    return { success: false, error: err.message || "Database operation failed." };
  }
}

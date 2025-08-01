// app/actions/stats.ts
"use server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/lib/authOptions";
import clientPromise from "@/app/lib/mongodb";
import { ObjectId } from "mongodb";
import { revalidatePath } from 'next/cache';

const ANALYSIS_CREDIT_COST = 40;

// Define a type for our stats for better code safety
export interface UserStats {
  _id: ObjectId;
  userId: string;
  resume_created: number;
  application_tailored: number;
  application_tracked: number;
  ai_credits: number;
}

export async function getUserStats(): Promise<Partial<Omit<UserStats, "_id">> & { _id?: string }> {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    console.warn("No user session found. Cannot fetch stats.");
    return {};
  }

  try {
    const client = await clientPromise;
    const db = client.db();

    const statsCollection = db.collection<UserStats>("stats");
    const stats = await statsCollection.findOne({ userId: session.user.id });

    const applicationTrackerCollection = db.collection("application_tracker");
    const trackedApplicationsCount = await applicationTrackerCollection.countDocuments({ userId: session.user.id });

    if (!stats) {
      console.warn(`No stats found for user: ${session.user.id}`);
      return {
        resume_created: 0,
        application_tailored: 0,
        application_tracked: trackedApplicationsCount,
        ai_credits: 0,
      };
    }

    return {
        ...stats,
        _id: stats._id.toString(),
        application_tracked: trackedApplicationsCount,
    };

  } catch (error) {
    console.error("Failed to fetch user stats:", error);
    return {
      resume_created: 0,
      application_tailored: 0,
      application_tracked: 0,
      ai_credits: 240,
    };
  }
}

export async function incrementResumeCreated() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    console.error("Attempted to increment count for an unauthenticated user.");
    return { error: "User not authenticated." };
  }

  try {
    const client = await clientPromise;
    const db = client.db();
    const statsCollection = db.collection("stats");

    const result = await statsCollection.updateOne(
      { userId: session.user.id },
      { $inc: { resume_created: 1 } }
    );

    if (result.matchedCount === 0) {
      console.warn(`Could not find stats document for user ${session.user.id} to increment.`);
      return { error: "Stats document not found." };
    }
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    console.error("Failed to increment resume_created count:", error);
    return { error: "Database operation failed." };
  }
}

export async function processSuccessfulAnalysis(jobTitle: string, jobDescription: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { error: "User not authenticated." };
  }

  try {
    const client = await clientPromise;
    const db = client.db();
    const statsCollection = db.collection("stats");

    const result = await statsCollection.updateOne(
      {
        userId: session.user.id,
        ai_credits: { $gte: ANALYSIS_CREDIT_COST }
      },
      {
        $inc: {
          application_tailored: 1,
          ai_credits: -ANALYSIS_CREDIT_COST
        }
      }
    );

    if (result.matchedCount === 0) {
      console.warn(`Could not process analysis for user ${session.user.id}: not enough credits or user not found.`);
      return { error: "Credit deduction failed on server." };
    }

    const applicationTrackerCollection = db.collection("application_tracker");
    await applicationTrackerCollection.insertOne({
      userId: session.user.id,
      jobTitle,
      jobDescription,
      status: 'Analyzed',
      createdAt: new Date(),
    });

    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    console.error("Failed to process successful analysis:", error);
    return { error: "Database operation failed." };
  }
}

// =========================================================================================
// == THIS IS THE FUNCTION THAT HAS BEEN FIXED =============================================
// =========================================================================================
// It now correctly handles database records that might be missing certain fields.
export async function getTrackedApplications() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return [];
  }

  try {
    const client = await clientPromise;
    const db = client.db();
    const applicationTrackerCollection = db.collection("application_tracker");

    const applications = await applicationTrackerCollection
      .find({ userId: session.user.id })
      .sort({ createdAt: -1 })
      .toArray();

    // THIS IS THE FIX: We explicitly construct the return object for each application.
    // This guarantees that every field required by the TrackedApplication type exists,
    // providing a default value if the field is missing from an older database record.
    return applications.map(app => ({
      _id: app._id.toString(),
      userId: app.userId.toString(),
      createdAt: app.createdAt.toISOString(),
      jobTitle: app.jobTitle || "", // Default to empty string
      jobDescription: app.jobDescription || "", // Default to empty string
      status: app.status || "Analyzed", // Default to "Analyzed"
    }));

  } catch (error) {
    console.error("Failed to fetch tracked applications:", error);
    return [];
  }
}

export async function updateApplicationStatus(applicationId: string, newStatus: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { error: "User not authenticated." };
  }

  const validStatuses = ["Analyzed", "Applied", "Interviewing", "Offer", "Rejected"];
  if (!validStatuses.includes(newStatus)) {
    return { error: "Invalid status provided." };
  }

  try {
    const client = await clientPromise;
    const db = client.db();
    const applicationTrackerCollection = db.collection("application_tracker");

    const result = await applicationTrackerCollection.updateOne(
      { _id: new ObjectId(applicationId), userId: session.user.id },
      { $set: { status: newStatus } }
    );

    if (result.matchedCount === 0) {
      return { error: "Application not found or permission denied." };
    }

    revalidatePath("/tracker");
    return { success: true };
  } catch (error) {
    console.error("Failed to update application status:", error);
    return { error: "Database operation failed." };
  }
}

export async function getAppliedCount() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return 0;
  }

  try {
    const client = await clientPromise;
    const db = client.db();
    const applicationTrackerCollection = db.collection("application_tracker");

    const count = await applicationTrackerCollection.countDocuments({
      userId: session.user.id,
      status: "Applied"
    });

    return count;

  } catch (error) {
    console.error("Failed to fetch applied count:", error);
    return 0;
  }
}

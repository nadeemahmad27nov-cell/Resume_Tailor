// File: src/app/api/analysis/[id]/route.ts

import { NextResponse } from 'next/server'; // For API response handling
import clientPromise from '@/app/lib/mongodb'; // MongoDB connection
import { ObjectId } from 'mongodb'; // To validate and create MongoDB _id

// This is the GET handler for the dynamic route [id]
export async function GET(request: Request) {
  try {
    // Parse the full URL to extract the ID from the path
    const url = new URL(request.url);
    const pathSegments = url.pathname.split('/');
    const idFromUrl = pathSegments[pathSegments.length - 1]; // Get the last part of the URL

    // Debug: Print ID received
    console.log(`[API] Received request for ID: ${idFromUrl}`);

    // Validate the ID format
    if (!ObjectId.isValid(idFromUrl)) {
      console.error(`[API] The ID "${idFromUrl}" is not a valid ObjectId format.`);
      return NextResponse.json({ error: 'Invalid ID format from URL' }, { status: 400 });
    }

    // Connect to MongoDB
    const client = await clientPromise;
    const db = client.db("ResumeTailor"); // Make sure this DB name matches yours

    console.log(`[API] Connecting to DB: "${db.databaseName}", Collection: "analyses"`);

    // Prepare query using ObjectId
    const query = { _id: new ObjectId(idFromUrl) };
    console.log(`[API] Executing query:`, JSON.stringify(query));

    // Query the database
    const analysis = await db.collection('analyses').findOne(query);

    // Check if result was found
    if (!analysis) {
      console.error(`[API] FAILED: Document with ID "${idFromUrl}" not found.`);
      return NextResponse.json({ error: 'Analysis data not found in database.' }, { status: 404 });
    }

    // Success: Return data
    console.log(`[API] SUCCESS: Found document for ID "${idFromUrl}".`);
    return NextResponse.json(analysis);

  } catch (e) {
    // Handle any unexpected error
    console.error("[API] FATAL ERROR in catch block:", e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

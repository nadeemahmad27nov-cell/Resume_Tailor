// File: src/app/api/auth/[...nextauth]/route.ts

import NextAuth from "next-auth";
import EmailProvider from "next-auth/providers/email";
import { MongoDBAdapter } from "@auth/mongodb-adapter";
import { createTransport } from "nodemailer";
import clientPromise from "@/app/lib/mongodb";
import { authOptions } from "@/app/lib/authOptions";

// Utility function: HTML email content
function html({ url }: { url: string }) {
  const brandColor = "#7e22ce";
  return `
<body style="background-color: #f3f4f6; padding: 20px;">
  <table style="max-width: 600px; margin: auto;">
    <tr>
      <td align="center" style="background: white; border-radius: 8px; padding: 20px;">
        <h1>ResumeTailor</h1>
        <p>Please click the button below to sign in:</p>
        <a href="${url}" style="padding: 12px 20px; background-color: ${brandColor}; color: white; text-decoration: none; border-radius: 6px;">Sign In</a>
        <p>This link is valid for 24 hours.</p>
      </td>
    </tr>
  </table>
</body>`;
}

// Utility function: plain text version
function text({ url }: { url: string }) {
  return `Sign in to ResumeTailor:\n${url}\n\nThis link is valid for 24 hours.`;
}

// 🔐 Ensure all environment variables are present
const requiredEnvVars = [
  "EMAIL_SERVER_HOST",
  "EMAIL_SERVER_PORT",
  "EMAIL_SERVER_USER",
  "EMAIL_SERVER_PASSWORD",
  "EMAIL_FROM",
  "NEXTAUTH_SECRET",
];
const missing = requiredEnvVars.filter((k) => !process.env[k]);
if (missing.length) {
  throw new Error(`❌ Missing env variables: ${missing.join(", ")}`);
}

// ✅ Define the auth options
const handler = NextAuth({
  adapter: MongoDBAdapter(clientPromise),
  providers: [
    EmailProvider({
      server: {
        host: process.env.EMAIL_SERVER_HOST!,
        port: Number(process.env.EMAIL_SERVER_PORT!),
        auth: {
          user: process.env.EMAIL_SERVER_USER!,
          pass: process.env.EMAIL_SERVER_PASSWORD!,
        },
      },
      from: process.env.EMAIL_FROM!,
      async sendVerificationRequest({ identifier: email, url, provider }) {
        const transport = createTransport(provider.server);
        await transport.sendMail({
          to: email,
          from: provider.from,
          subject: `Your Sign-In Link for ResumeTailor`,
          text: text({ url }),
          html: html({ url }),
        });
      },
    }),
  ],
  pages: {
    signIn: "/login",
    verifyRequest: "/login/verify-request",
    error: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET!,
  events: {
    async createUser({ user }) {
      const client = await clientPromise;
      const db = client.db();
      await db.collection("stats").insertOne({
        userId: user.id,
        resume_created: 0,
        application_tailored: 0,
        application_tracked: 0,
        ai_credits: 240,
      });
    },
  },
  callbacks: {
    session: ({ session, user }) => {
      if (session.user) {
        session.user.id = user.id;
      }
      return session;
    },
  },
});

// ✅ Export ONLY the route handlers
export { handler as GET, handler as POST };

import { children, detections, humanRatings, promptVersions, reliabilityReport, rubricSkills, videos } from "../lib/data";

async function main() {
  console.log("Seed data prepared for prototype:");
  console.log({
    children: children.length,
    videos: videos.length,
    rubricSkills: rubricSkills.length,
    promptVersions: promptVersions.length,
    detections: detections.length,
    humanRatings: humanRatings.length,
    reliabilityReports: 1,
    currentReport: reliabilityReport.id
  });
  console.log("Wire these records into Prisma writes when a Postgres DATABASE_URL is available.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

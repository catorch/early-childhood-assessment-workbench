import { NextRequest, NextResponse } from "next/server";

import { rubricSkills } from "@/lib/data";

export async function GET(request: NextRequest) {
  const ageMonthsParam = request.nextUrl.searchParams.get("ageMonths");
  const ageMonths = ageMonthsParam ? Number(ageMonthsParam) : undefined;

  const skills = rubricSkills.filter((skill) => {
    if (typeof ageMonths !== "number" || Number.isNaN(ageMonths)) return true;
    return skill.minAgeMonths <= ageMonths && skill.maxAgeMonths >= ageMonths;
  });

  const ageGateWarnings = rubricSkills
    .filter((skill) => !skill.productionReady)
    .map((skill) => `${skill.skillCode} is not production ready`);

  return NextResponse.json({
    data: {
      skills,
      ageGateWarnings
    }
  });
}

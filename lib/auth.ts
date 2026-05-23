export const currentUser = {
  id: "user_sarah_chen",
  name: "Sarah Chen",
  email: "sarah.chen@example.test",
  role: "Admin",
  avatarUrl: "https://i.pravatar.cc/96?img=47"
};

export function requireRole(allowedRoles: Array<"Operator" | "Reviewer" | "Content Advisor" | "Admin" | "Engineer">) {
  if (!allowedRoles.includes(currentUser.role as never)) {
    return {
      ok: false as const,
      status: 403,
      error: "Forbidden"
    };
  }

  return {
    ok: true as const,
    user: currentUser
  };
}

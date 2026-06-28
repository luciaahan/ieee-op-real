export const COMMITTEES = [
  {
    id: "committee-exec",
    slug: "exec",
    name: "Exec",
    description: "Exec board — weekly meeting notes and org-wide programs.",
    trackingType: "operational",
    sortOrder: 0,
  },
  {
    id: "committee-prez",
    slug: "prez",
    name: "Prez",
    description:
      "Org leadership — President and VP coordinate all committees, run exec meetings, and track finances.",
    trackingType: "operational",
    sortOrder: 1,
  },
  {
    id: "committee-internal-relations",
    slug: "internal-relations",
    name: "Internal Relations",
    description:
      "Campus logistics — books rooms and coordinates reservations for org events.",
    trackingType: "rooms",
    sortOrder: 2,
  },
  {
    id: "committee-social",
    slug: "social",
    name: "Social",
    description: "Community building and member bonding.",
    trackingType: "events",
    sortOrder: 3,
  },
  {
    id: "committee-research",
    slug: "research",
    name: "Research",
    description: "Exposure to research paths and faculty work.",
    trackingType: "events",
    sortOrder: 4,
  },
  {
    id: "committee-pre-professional",
    slug: "pre-professional",
    name: "Pre-professional",
    description: "Career readiness via mentor-mentee program.",
    trackingType: "events",
    sortOrder: 5,
  },
  {
    id: "committee-corporate",
    slug: "corporate",
    name: "Corporate",
    description: "Industry relationships and recruiting.",
    trackingType: "events",
    sortOrder: 6,
  },
  {
    id: "committee-pr",
    slug: "pr",
    name: "Public Relations",
    description: "Instagram account and posters per org event.",
    trackingType: "deliverables",
    sortOrder: 7,
  },
  {
    id: "committee-doghouse",
    slug: "doghouse",
    name: "Doghouse",
    description: "CMU Spring Carnival doghouse booth build.",
    trackingType: "events",
    sortOrder: 8,
  },
  {
    id: "committee-outreach",
    slug: "outreach",
    name: "Outreach",
    description: "Community and pipeline engagement.",
    trackingType: "events",
    sortOrder: 9,
  },
] as const;

export type ChecklistCondition =
  | "always"
  | "needs_food"
  | "needs_supplies"
  | "has_external_guests"
  | "needs_food_or_supplies";

export const EVENT_PLANNING_TEMPLATE: {
  offsetDays: number;
  title: string;
  sortOrder: number;
  isOptional: boolean;
  isRecommended: boolean;
  condition: ChecklistCondition;
  linksToDeliverable?: boolean;
}[] = [
  { offsetDays: 14, title: "Finalize details of event", sortOrder: 1, isOptional: false, isRecommended: false, condition: "always" },
  { offsetDays: 14, title: "Confirm attendance of company or faculty guests", sortOrder: 2, isOptional: true, isRecommended: false, condition: "has_external_guests" },
  { offsetDays: 14, title: "Order supplies, if needed — email Kimmy", sortOrder: 3, isOptional: true, isRecommended: false, condition: "needs_supplies" },
  { offsetDays: 14, title: "Make sign-up form for headcount", sortOrder: 4, isOptional: false, isRecommended: false, condition: "always" },
  { offsetDays: 14, title: "Request event blurb for next weekly announcement", sortOrder: 5, isOptional: false, isRecommended: false, condition: "always" },
  { offsetDays: 7, title: "All posters are up (including on social media)", sortOrder: 1, isOptional: false, isRecommended: false, condition: "always", linksToDeliverable: true },
  { offsetDays: 7, title: "Order food if needed", sortOrder: 2, isOptional: true, isRecommended: false, condition: "needs_food" },
  { offsetDays: 3, title: "Check RSVP count (adjust food/room if needed)", sortOrder: 1, isOptional: false, isRecommended: false, condition: "always" },
  { offsetDays: 3, title: "Ensure at least 2 other exec board members can be present", sortOrder: 2, isOptional: false, isRecommended: false, condition: "always" },
  { offsetDays: 3, title: "Make food pickup arrangements, if needed", sortOrder: 3, isOptional: true, isRecommended: false, condition: "needs_food" },
  { offsetDays: 3, title: "Have slides prepared", sortOrder: 4, isOptional: true, isRecommended: false, condition: "always" },
  { offsetDays: 0, title: "Pick up food and/or supplies, if needed", sortOrder: 1, isOptional: true, isRecommended: false, condition: "needs_food_or_supplies" },
  { offsetDays: 0, title: "Arrive at room 30 minutes prior to set up", sortOrder: 2, isOptional: false, isRecommended: false, condition: "always" },
  { offsetDays: 0, title: "Write attendance form link on board / keep visible", sortOrder: 3, isOptional: false, isRecommended: false, condition: "always" },
  { offsetDays: 0, title: "Take photos", sortOrder: 4, isOptional: false, isRecommended: false, condition: "always" },
  { offsetDays: 0, title: "Clean up the room after event", sortOrder: 5, isOptional: false, isRecommended: false, condition: "always" },
  { offsetDays: 0, title: "Log Expenses", sortOrder: 6, isOptional: false, isRecommended: false, condition: "always" },
];

export const DEMO_USERS = [
  {
    id: "user-president",
    email: "president@andrew.cmu.edu",
    name: "Demo President",
    canEditAll: true,
    canManageUsers: true,
    committees: [
      "exec",
      "prez",
      "internal-relations",
      "social",
      "research",
      "pre-professional",
      "corporate",
      "pr",
      "doghouse",
      "outreach",
    ],
  },
  {
    id: "user-internal-relations",
    email: "internal-relations@andrew.cmu.edu",
    name: "Demo Internal Relations Chair",
    canEditAll: false,
    canManageUsers: false,
    committees: ["exec", "internal-relations"],
  },
  {
    id: "user-social",
    email: "social@andrew.cmu.edu",
    name: "Demo Social Chair",
    canEditAll: false,
    canManageUsers: false,
    committees: ["exec", "social"],
  },
  {
    id: "user-pr",
    email: "pr@andrew.cmu.edu",
    name: "Demo PR Chair",
    canEditAll: false,
    canManageUsers: false,
    committees: ["exec", "pr"],
  },
];

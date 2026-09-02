import type { ProblemMapEntry } from "./types";

/**
 * Demo analysis is built from archetypes selected by keyword-matching the
 * founder's own intake text, so the output reflects what they actually typed
 * rather than being a fixed script. A real provider replaces this wholesale.
 */

export interface Archetype {
  id: string;
  /** Matched against the founder's description, problem and target customer. */
  signals: string[];
  primaryCustomer: string;
  secondaryCustomer: string;
  roles: string[];
  industries: string[];
  companySize: string;
  painPoints: string[];
  buyingTriggers: string[];
  objections: string[];
  problemMap: ProblemMapEntry[];
  searchTopics: string[];
}

export const ARCHETYPES: Archetype[] = [
  {
    id: "support-automation",
    signals: [
      "support",
      "ticket",
      "helpdesk",
      "customer service",
      "inbox",
      "cx",
      "live chat",
      "knowledge base",
      "deflect",
    ],
    primaryCustomer:
      "Head of Support or CX at a 10–100 person software company where ticket volume is growing faster than headcount",
    secondaryCustomer:
      "Technical founders still personally handling front-line support and losing build time to it",
    roles: [
      "Head of Customer Support",
      "Customer Success Manager",
      "Support Operations Lead",
      "Technical founder",
      "COO",
    ],
    industries: ["B2B SaaS", "E-commerce", "Fintech", "Developer tools"],
    companySize: "10–100 employees",
    painPoints: [
      "The same handful of questions arrive over and over",
      "First response time is slipping and customers have noticed",
      "Support headcount is flat while volume climbs",
      "The founder is absorbing support instead of building",
      "Enterprise helpdesk pricing is out of reach at this stage",
    ],
    buyingTriggers: [
      "A renewal quote from an incumbent tool comes in too high",
      "Response time breaches an SLA or gets called out publicly",
      "A support hire is rejected in budget planning",
      "Ticket volume jumps after a launch or pricing change",
    ],
    objections: [
      "Automation will make us sound robotic and hurt CSAT",
      "We tried a bot before and had to roll it back",
      "Migrating off our current helpdesk sounds painful",
      "We are too small for another tool in the stack",
    ],
    problemMap: [
      {
        problem: "Too many repetitive customer-support tickets",
        relatedProblems: [
          "Slow first response time",
          "Support team overloaded",
          "Founder handling support instead of building",
          "Hiring more support is too expensive",
          "No time to write documentation that would prevent tickets",
        ],
      },
      {
        problem: "Support cost scales linearly with customers",
        relatedProblems: [
          "Margin erodes as the customer base grows",
          "Cannot forecast support headcount",
          "Quality drops during volume spikes",
        ],
      },
    ],
    searchTopics: [
      "customer support automation",
      "repetitive support tickets",
      "support team overwhelmed",
      "reduce support workload",
      "helpdesk alternative",
      "first response time",
      "ticket deflection",
      "founder doing support",
    ],
  },
  {
    id: "growth-acquisition",
    signals: [
      "marketing",
      "acquisition",
      "growth",
      "leads",
      "outreach",
      "audience",
      "distribution",
      "traffic",
      "seo",
      "conversations",
    ],
    primaryCustomer:
      "Solo or two-person SaaS founder with a working product, under 50 users, and no reliable acquisition channel",
    secondaryCustomer:
      "Early growth hires at seed-stage startups told to 'figure out distribution' with no budget",
    roles: ["Solo founder", "Technical co-founder", "Head of Growth", "Indie hacker"],
    industries: ["B2B SaaS", "Developer tools", "Productivity software"],
    companySize: "1–10 employees",
    painPoints: [
      "No idea where the target customers actually spend time",
      "Posting into communities and getting no response",
      "Cannot tell which conversations are worth the effort",
      "No budget for paid acquisition",
      "Marketing time competes directly with build time",
    ],
    buyingTriggers: [
      "A launch lands flat and produces no signups",
      "Runway pressure makes distribution urgent",
      "A competitor visibly wins in a community they are also in",
      "Manual prospecting starts eating a full day a week",
    ],
    objections: [
      "This looks like it will encourage spam and get me banned",
      "I have tried growth tools and they all produce noise",
      "I do not have time to learn another dashboard",
      "How is this different from just searching manually",
    ],
    problemMap: [
      {
        problem: "No repeatable way to find the first customers",
        relatedProblems: [
          "Unclear who the ideal customer actually is",
          "Do not know which communities matter",
          "Cannot judge which conversations are worth joining",
          "No sense of what to say without sounding promotional",
        ],
      },
      {
        problem: "Effort spent on marketing produces no measurable result",
        relatedProblems: [
          "No attribution between activity and signups",
          "Cannot tell whether the channel or the message is wrong",
          "Gives up on a channel before it had a fair test",
        ],
      },
    ],
    searchTopics: [
      "how to get first customers",
      "customer acquisition for saas",
      "no users after launch",
      "where to find early customers",
      "reddit marketing for saas",
      "first 10 customers",
      "distribution for indie hackers",
      "finding relevant conversations",
    ],
  },
  {
    id: "activation-retention",
    signals: [
      "onboarding",
      "activation",
      "churn",
      "retention",
      "engagement",
      "adoption",
      "trial",
    ],
    primaryCustomer:
      "Product lead or founder at a SaaS company where signups are healthy but activation and retention are not",
    secondaryCustomer:
      "Growth engineers responsible for the trial-to-paid funnel",
    roles: ["Head of Product", "Growth PM", "Founder", "Growth engineer"],
    industries: ["B2B SaaS", "Consumer subscription", "Developer tools"],
    companySize: "5–50 employees",
    painPoints: [
      "Users sign up and never reach the core value",
      "Setup is too long and people drop out midway",
      "Churn is masking acquisition progress",
      "No visibility into where users stall",
    ],
    buyingTriggers: [
      "Activation rate drops below an acceptable floor",
      "Paid acquisition spend stops paying back",
      "A board or investor asks about retention specifically",
    ],
    objections: [
      "We already have analytics and do not use them",
      "This feels like it needs engineering time we do not have",
      "Our problem is acquisition, not activation",
    ],
    problemMap: [
      {
        problem: "Users sign up but never activate",
        relatedProblems: [
          "Onboarding has too many steps",
          "Value is not obvious in the first session",
          "Errors during setup go unnoticed",
          "No follow-up with users who stall",
        ],
      },
    ],
    searchTopics: [
      "improve user activation",
      "saas onboarding drop off",
      "trial to paid conversion",
      "reduce churn early stage",
      "users sign up but never come back",
      "activation rate benchmark",
    ],
  },
  {
    id: "developer-tools",
    signals: [
      "developer",
      "api",
      "sdk",
      "ci",
      "deploy",
      "infrastructure",
      "code",
      "engineering",
      "devops",
    ],
    primaryCustomer:
      "Engineering lead or platform engineer at a 10–200 person company responsible for developer productivity",
    secondaryCustomer:
      "Individual developers who adopt tools bottom-up and advocate internally",
    roles: [
      "Staff engineer",
      "Platform engineer",
      "Engineering manager",
      "DevOps lead",
      "CTO",
    ],
    industries: ["Software", "Fintech", "Developer tools", "Infrastructure"],
    companySize: "10–200 employees",
    painPoints: [
      "Manual steps in the workflow waste engineering hours",
      "Existing tooling is fragmented and hard to maintain",
      "Hard to justify spend without proving developer time saved",
      "Adoption stalls if setup takes more than an afternoon",
    ],
    buyingTriggers: [
      "An incident traced back to a tooling gap",
      "Team growth makes a manual process untenable",
      "An existing vendor raises prices or is deprecated",
    ],
    objections: [
      "We could build this ourselves in a sprint",
      "Adding a vendor means a security review",
      "How does this fit our existing pipeline",
    ],
    problemMap: [
      {
        problem: "Engineering time lost to manual, repeatable work",
        relatedProblems: [
          "Inconsistent processes across teams",
          "Onboarding new engineers takes too long",
          "Tooling sprawl with no clear owner",
        ],
      },
    ],
    searchTopics: [
      "developer productivity tools",
      "automate engineering workflow",
      "ci cd pain points",
      "internal tooling",
      "platform engineering",
    ],
  },
];

/** Generic fallback so an unrecognised product still produces a usable analysis. */
export const FALLBACK_ARCHETYPE: Archetype = {
  id: "general-b2b",
  signals: [],
  primaryCustomer:
    "Operator at a small business or startup who owns the problem your product solves and feels it weekly",
  secondaryCustomer:
    "The person one level up who approves the budget once the problem is proven",
  roles: ["Founder", "Operations lead", "Department head"],
  industries: ["B2B SaaS", "Professional services", "E-commerce"],
  companySize: "1–50 employees",
  painPoints: [
    "The problem is handled manually and takes real time each week",
    "Existing tools are too expensive or too complex for this stage",
    "No clear owner, so the problem persists",
  ],
  buyingTriggers: [
    "The manual workaround visibly breaks as the business grows",
    "A budget cycle opens up",
    "A peer recommends a specific approach",
  ],
  objections: [
    "We already have a workaround that mostly works",
    "This is not a priority this quarter",
    "How do I know it will work for our situation",
  ],
  problemMap: [
    {
      problem: "A recurring operational problem handled manually",
      relatedProblems: [
        "Time lost to repeated work",
        "Inconsistent results",
        "Difficult to delegate",
      ],
    },
  ],
  searchTopics: [
    "how do I automate",
    "looking for a tool",
    "best tool for",
    "alternative to",
    "manual process",
  ],
};

/** Intent phrases from PRD s6 — used verbatim as demo intent signals. */
export const BASE_INTENT_SIGNALS = [
  "how do i",
  "looking for",
  "anyone using",
  "what tool",
  "alternative to",
  "struggling with",
  "how are you solving",
  "recommend",
];

export function selectArchetype(text: string): Archetype {
  const haystack = text.toLowerCase();

  let best: { archetype: Archetype; hits: number } | null = null;
  for (const archetype of ARCHETYPES) {
    const hits = archetype.signals.filter((signal) =>
      haystack.includes(signal),
    ).length;
    if (hits > 0 && (!best || hits > best.hits)) {
      best = { archetype, hits };
    }
  }

  return best?.archetype ?? FALLBACK_ARCHETYPE;
}

export type AffiliateDeal = {
  firmName: string;
  slug: string;
  promoCode: string;
  discountText: string;
  affiliateUrl: string;
  accountTypes: string[];
  payoutNote: string;
  riskNote: string;
  personalVerdict: string;
  bestFor: string;
  trackingTip: string;
  riskReminder: string;
  sortOrder: number;
  featured: boolean;
};

export const affiliateDeals: AffiliateDeal[] = [
  {
    firmName: "Lucid Trading",
    slug: "lucid-trading",
    promoCode: "YOURCODE",
    discountText: "Use the code for the current available discount.",
    affiliateUrl: "https://example.com/lucid-trading",
    accountTypes: ["Challenge", "Funded account"],
    payoutNote: "Track payout proof and withdrawal timing before scaling.",
    riskNote: "Check daily loss, max loss and consistency rules before buying.",
    personalVerdict: "Good candidate to track if you want a clean challenge workflow.",
    bestFor: "Traders who want a straightforward challenge-style account to compare.",
    trackingTip: "Track the first fee, any reset and the first payout separately.",
    riskReminder: "Read loss limits and payout timing before using any promo code.",
    sortOrder: 10,
    featured: true,
  },
  {
    firmName: "FTMO",
    slug: "ftmo",
    promoCode: "YOURCODE",
    discountText: "Add your promo code or offer here.",
    affiliateUrl: "https://example.com/ftmo",
    accountTypes: ["Challenge", "Verification"],
    payoutNote: "Use the dashboard to compare challenge cost vs confirmed payouts.",
    riskNote: "Rules are strict; treat the fee like a business expense.",
    personalVerdict: "Best for traders who want established rules and clear tracking.",
    bestFor: "Rule-focused traders who want a familiar evaluation model.",
    trackingTip: "Compare challenge cost against confirmed payouts, not marketing claims.",
    riskReminder: "Passing a challenge does not guarantee future payouts or profits.",
    sortOrder: 20,
    featured: true,
  },
  {
    firmName: "The5ers",
    slug: "the5ers",
    promoCode: "YOURCODE",
    discountText: "Replace this with your active affiliate offer.",
    affiliateUrl: "https://example.com/the5ers",
    accountTypes: ["Challenge", "Bootcamp", "Funded"],
    payoutNote: "Track every payout and refund separately for real ROI.",
    riskNote: "Compare account type, time limits and scaling rules before buying.",
    personalVerdict: "Useful to compare against instant-funding style accounts.",
    bestFor: "Traders comparing classic challenges with scaling or bootcamp models.",
    trackingTip: "Separate initial fees, upgrades and refunds so ROI stays honest.",
    riskReminder: "Different account types can have very different rule pressure.",
    sortOrder: 30,
    featured: false,
  },
];

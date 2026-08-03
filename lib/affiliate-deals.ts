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
    featured: false,
  },
];

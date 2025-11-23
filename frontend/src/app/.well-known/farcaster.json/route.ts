export async function GET() {
  const config = {
    accountAssociation: {
      header:
        "eyJmaWQiOjEzNTk2LCJ0eXBlIjoiY3VzdG9keSIsImtleSI6IjB4ODE3MzE4RDZmRkY2NkExOGQ4M0ExMzc2QTc2RjZlMzBCNDNjODg4OSJ9",
      payload: "eyJkb21haW4iOiJhZ2VudGljYS13YWxsZXQudmVyY2VsLmFwcCJ9",
      signature:
        "vu0DVdzuHvllPdcv1Wy1q75UgU/ZoDqaa2gZ1vFtPGJ8c1ASkDQ7igMC3YAdZHtNG/guBs/zkU3qdeJR6FNfCBw=",
    },
    frame: {
      version: "1",
      name: "Agentica",
      iconUrl: "https://agentica-wallet.vercel.app/icon.png",
      homeUrl: "https://agentica-wallet.vercel.app",
      imageUrl: "https://agentica-wallet.vercel.app/opengraph-image",
      ogImageUrl: `https://agentica-wallet.vercel.app/opengraph-image`,
      buttonTitle: "create your agent",
      splashImageUrl: "https://agentica-wallet.vercel.app/icon.png",
      splashBackgroundColor: "#eeccff",
      description: "the wallet that helps you sleep better",
      primaryCategory: "social",
      // webhookUrl: "https://agentica-wallet.vercel.app/api/webhook",
    },
    baseBuilder: {
      ownerAddress: "0x07B7BC3787e10FD7dA54AbBD35173F8c2A483774",
    },
  };

  return Response.json(config);
}

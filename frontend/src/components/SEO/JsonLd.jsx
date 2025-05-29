function WebPageSchema(pageTag, schemaDescription, schemaUrl) {
  return (
    <script type="application/ld+json">
      {{
        "@context": "https://schema.org",
        "@type": "WebPage",
        name: { pageTag },
        description: { schemaDescription },
        url: { schemaUrl },
      }}
    </script>
  );
}

function ProductPageSchema(
  productImgUrl,
  productDescription,
  // storeKeepingUnit,
  currency,
  productPrice
) {
  return (
    <script type="application/ld+json">
      {{
        "@context": "https://schema.org",
        "@type": "WebPage",
        name: "Product",
        image: { productImgUrl },
        description: { productDescription },
        // sku: { storeKeepingUnit }, // for E-Commerce not Affiliate
        offers: {
          "@type": "Offer",
          priceCurrency: { currency },
          price: { productPrice },
        },
      }}
    </script>
  );
}

export { WebPageSchema, ProductPageSchema };

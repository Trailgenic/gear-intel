CREATE TEMP TABLE approved_candidate_decisions (
  candidate_id uuid PRIMARY KEY,
  decision text NOT NULL,
  note text NOT NULL,
  category_key text,
  brand text,
  product_name text,
  model_version text,
  official_url text,
  rationale text,
  evidence_urls jsonb
) ON COMMIT DROP;

INSERT INTO approved_candidate_decisions VALUES
(
  '15fe4342-6053-4171-a4b1-6317870aa977', 'accepted',
  'Approved after exact-product source review; official model identity and sources corrected.',
  'trail-shoes', 'Altra', 'Olympus 275 HiLo', '2026 / AL0A85WT',
  'https://www.altrarunning.com/en-us/products/mens-olympus-275-hilo-al0a85wt',
  'New 2026 technical-trail model with an exact manufacturer page and independent launch and wear-test coverage. TrailGenic fit remains unscored pending evidence review.',
  '["https://www.altrarunning.com/en-us/products/mens-olympus-275-hilo-al0a85wt","https://www.t3.com/active/running/altra-olympus-275-hilo-launch-0726","https://www.runnersworld.com/gear/a71306940/runners-world-shoe-awards-2026-trail-running-shoes/"]'::jsonb
),
(
  '0c5e6fd9-5a7e-4f05-a765-25e33da5c88d', 'accepted',
  'Approved as a conditional investigation candidate; urban orientation and 10K/10K membrane require explicit fit review.',
  'shell-rain', 'Peak Performance', 'Treeline HIPE 2.5L Shell Jacket', 'Autumn/Winter 2026 / G80856',
  'https://www.peakperformance.com/us/product/m-treeline-shell-jacket-g80856.html',
  'Genuine Autumn/Winter 2026 release with exact manufacturer and independent launch coverage. Its weight, weather ratings and urban-trail positioning may constrain TrailGenic fit.',
  '["https://www.peakperformance.com/us/product/m-treeline-shell-jacket-g80856.html","https://www.t3.com/active/outerwear/peak-performance-treeline-hipe-2-5l-shell-jacket-launch-0726"]'::jsonb
),
(
  '5086b122-cb68-4f69-8399-a8048441e446', 'accepted',
  'Approved as a conditional multi-use purification candidate; corrected from new 2026 framing to the current 2024 model.',
  'hydration', 'GRAYL', '24 oz GeoPress Ti Purifier', '2024 model / current production',
  'https://grayl.com/products/24oz-geopress-ti-water-filter-purifier-covert-edition',
  'Current multi-use titanium purifier introduced in 2024. Weight, cost and redundancy versus separate lightweight systems require explicit evidence-based assessment.',
  '["https://grayl.com/products/24oz-geopress-ti-water-filter-purifier-covert-edition","https://gearjunkie.com/camping/grayl-geopress-ti-review","https://outdoorx4.com/stories/field-review-grayl-geopress-ti-purifier/"]'::jsonb
),
(
  '9abfc97f-8c3a-4702-aa03-24ff14f2fe93', 'accepted',
  'Approved after exact manufacturer and independent laboratory/wear-test confirmation.',
  'trail-shoes', 'Nike', 'ACG Ultrafly Trail', '2026 / HF5668',
  'https://www.nike.com/t/acg-ultrafly-trail-trail-racing-shoes-uNHxL3GA',
  'Current 2026 trail-racing model with official product identity, extensive development history and independent laboratory and wear-test evidence. Hiking applicability remains conditional.',
  '["https://www.nike.com/t/acg-ultrafly-trail-trail-racing-shoes-uNHxL3GA","https://about.nike.com/en/newsroom/releases/nike-acg-ultrafly-official-images","https://runrepeat.com/nike-acg-ultrafly-trail","https://www.runnersworld.com/gear/a71306940/runners-world-shoe-awards-2026-trail-running-shoes/"]'::jsonb
),
(
  '015216d0-3fe4-48d3-a733-13e63865ec59', 'accepted',
  'Approved with exact 2026 revision identity and product-specific field evidence.',
  'shell-rain', 'Outdoor Research', 'Helium UL Jacket', '2026 revision / 322681',
  'https://www.outdoorresearch.com/products/mens-helium-ul-jacket-322681',
  'Ultralight 2026 shell revision with exact manufacturer and independent testing. Evidence must preserve its emergency-layer strengths and durability, clamminess and sustained-weather limitations.',
  '["https://www.outdoorresearch.com/products/mens-helium-ul-jacket-322681","https://www.outdoorgearlab.com/reviews/clothing-mens/rain-jacket-men/outdoor-research-helium-ul","https://www.t3.com/active/hiking-walking/outdoor-research-helium-ul-jacket-review"]'::jsonb
),
(
  '1cb437de-dda5-41ee-94c3-806d664ac2d9', 'accepted',
  'Approved after correcting the raw scan material error: mapped down insulation, not synthetic.',
  'insulation', 'Nike ACG', 'Lava Loft Jacket', '2026 release',
  'https://www.nike.com/a/nike-acg-lava-loft-release-info/',
  'Current 2026 mapped-down active insulation piece with manufacturer release documentation and independent field review. The original synthetic-insulation description was rejected.',
  '["https://www.nike.com/a/nike-acg-lava-loft-release-info/","https://www.roadtrailrun.com/2026/02/worn-to-be-wld-nike-acg-lava-loft.html"]'::jsonb
),
(
  '4194c750-5f1a-4071-ba52-9a1b5a95d333', 'accepted',
  'Approved as an established current product; weak affiliate source replaced with manufacturer and current independent evidence.',
  'electrolytes', 'Skratch Labs', 'Hydration Sport Drink Mix', '2026 catalog formulation',
  'https://www.skratchlabs.com/products/hydration-sport-drink-mix',
  'Established carbohydrate-plus-electrolyte product with an active 2026 catalog presence and current independent endurance testing. Protocol fit depends on fueling context and cannot be inferred from popularity.',
  '["https://www.skratchlabs.com/products/hydration-sport-drink-mix","https://www.cyclingweekly.com/fitness/nutrition/energy-drinks-cycling-hydration-31549"]'::jsonb
),
(
  'acfa5df2-07ed-4eac-ac4b-75ff7e2fa3fe', 'accepted',
  'Approved with exact manufacturer SKU and exact 2026 comparative assessment.',
  'backpacks', 'REI Co-op', 'Flash Air 50 Pack', 'SKU 227897 / 2026 current production',
  'https://www.rei.com/product/227897/rei-co-op-flash-air-50-pack-mens',
  'Current ultralight framed pack with exact manufacturer identity and current independent comparative testing. Load range, comfort and compression limitations require evidence review.',
  '["https://www.rei.com/product/227897/rei-co-op-flash-air-50-pack-mens","https://www.outdoorgearlab.com/reviews/camping-and-hiking/ultralight-backpack/rei-co-op-flash-air-50"]'::jsonb
),
(
  '4b8d937a-df19-46b0-bb3a-5c1ce08162a7', 'accepted',
  'Approved as an established current product, not a new 2026 release.',
  'backpacks', 'Hyperlite Mountain Gear', 'Unbound 40', 'Unbound 40 DCH / 2026 current production',
  'https://hyperlitemountaingear.com/products/unbound',
  'Established ultralight thru-hiking pack with current manufacturer availability and 2026 comparative testing. It is distinct from the seeded 3400 Southwest family.',
  '["https://hyperlitemountaingear.com/products/unbound","https://www.outdoorgearlab.com/topics/camping-and-hiking/best-ultralight-backpack","https://www.cleverhiker.com/backpacking/hyperlite-mountain-gear-unbound-40-ultralight-backpack-review/"]'::jsonb
),
(
  '83ff6fe8-f5f8-4f78-b14f-5e4fb6406e95', 'accepted',
  'Approved after removing the unrelated SEC filing and replacing it with exact manufacturer and field-review evidence.',
  'trekking-poles', 'Leki', 'Makalu FX Carbon', '65620621S',
  'https://www.leki.com/int/en/Makalu-FX-Carbon/65620621S',
  'Current adjustable carbon folding pole with exact manufacturer identity and current product-specific field evidence. Weight and durability tradeoffs remain for deterministic assessment.',
  '["https://www.leki.com/int/en/Makalu-FX-Carbon/65620621S","https://outdoorguru.com/gear/leki-makalu-fx-carbon-trekking-pole-review/","https://hiking-trails.com/review/leki-makalu-fx-carbon-review/"]'::jsonb
),
(
  'e1441318-cb1d-4407-9b65-3e5b98b54119', 'held',
  'Held: exact current product is real, but the discovery run supplied no independent exact-product reservoir evidence.',
  NULL, NULL, NULL, NULL, NULL, NULL, NULL
),
(
  '6770b37e-88f7-408d-b8d5-a25cf6a1a159', 'held',
  'Held: 2023 model, relatively heavy and proprietary charging; current attention did not substantiate a new or priority TrailGenic candidate.',
  NULL, NULL, NULL, NULL, NULL, NULL, NULL
),
(
  'e46e3d66-1c20-4b33-b7ae-d7f361c54f48', 'held',
  'Held: older high-output model with substantial weight and stronger caving/specialty positioning than movement-efficient hiking relevance.',
  NULL, NULL, NULL, NULL, NULL, NULL, NULL
),
(
  '5ad7d245-1a36-4586-95c2-0f2b4e5ec53c', 'held',
  'Held: launch timing was misstated and current evidence positions the family more toward travel and everyday warmth than technical active insulation.',
  NULL, NULL, NULL, NULL, NULL, NULL, NULL
),
(
  'e4e940e3-0aca-4c9a-b54a-73ea51522fb1', 'held',
  'Held: exact Connect Carbon 5 Cross model/SKU identity was not resolved and most exact testing predates the claimed trend window.',
  NULL, NULL, NULL, NULL, NULL, NULL, NULL
),
(
  'ff45f08b-0782-4f75-b3c1-ff49c2199116', 'duplicate',
  'Duplicate of the seeded LMNT Electrolyte Packets product family; update the existing record rather than creating a second product.',
  NULL, NULL, NULL, NULL, NULL, NULL, NULL
);

DO $$
BEGIN
  IF (SELECT count(*) FROM approved_candidate_decisions) <> 16 THEN
    RAISE EXCEPTION 'Expected 16 approved candidate decisions';
  END IF;
  IF (
    SELECT count(*)
    FROM approved_candidate_decisions AS decision
    JOIN product_candidates AS candidate ON candidate.id = decision.candidate_id
  ) <> 16 THEN
    RAISE EXCEPTION 'Approved candidate slate does not match the discovery records';
  END IF;
END $$;

UPDATE product_candidates AS candidate
SET status = decision.decision,
    reviewed_by = 'Mike Ye',
    reviewed_at = now(),
    review_note = decision.note,
    review_corrections = CASE WHEN decision.decision = 'accepted' THEN
      jsonb_strip_nulls(jsonb_build_object(
        'categoryKey', decision.category_key,
        'brand', decision.brand,
        'productName', decision.product_name,
        'modelVersion', decision.model_version,
        'officialUrl', decision.official_url,
        'rationale', decision.rationale,
        'evidenceUrls', decision.evidence_urls
      ))
      ELSE '{}'::jsonb
    END
FROM approved_candidate_decisions AS decision
WHERE candidate.id = decision.candidate_id;

INSERT INTO products (brand, product_family, category_id, status)
SELECT decision.brand, decision.product_name, category.id, 'candidate'
FROM approved_candidate_decisions AS decision
JOIN categories AS category ON category.key = decision.category_key
WHERE decision.decision = 'accepted'
ON CONFLICT (brand, product_family, category_id)
DO UPDATE SET updated_at = now();

INSERT INTO product_versions (product_id, model_version, display_name, manufacturer_url)
SELECT product.id,
       decision.model_version,
       decision.brand || ' ' || decision.product_name,
       decision.official_url
FROM approved_candidate_decisions AS decision
JOIN categories AS category ON category.key = decision.category_key
JOIN products AS product
  ON product.category_id = category.id
 AND product.brand = decision.brand
 AND product.product_family = decision.product_name
WHERE decision.decision = 'accepted'
ON CONFLICT (product_id, model_version)
DO UPDATE SET display_name = EXCLUDED.display_name,
              manufacturer_url = EXCLUDED.manufacturer_url,
              updated_at = now();

UPDATE product_versions AS version
SET manufacturer_url = 'https://drinklmnt.com/products/lmnt-recharge-electrolyte-drink',
    updated_at = now()
FROM products AS product
JOIN categories AS category ON category.id = product.category_id
WHERE version.product_id = product.id
  AND product.brand = 'LMNT'
  AND product.product_family = 'Electrolyte Packets'
  AND category.key = 'electrolytes';

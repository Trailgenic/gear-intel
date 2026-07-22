# Operating Gear Intelligence

## First deployment

After the production environment variables are configured, initialize the database once through the protected endpoint:

```bash
curl -X POST https://YOUR_DEPLOYMENT/api/admin/initialize \
  -H "Authorization: Bearer $ADMIN_API_TOKEN"
```

The operation is idempotent. It reports applied or previously applied migrations and reseeds the current rubric definitions and legacy candidates without duplicating them.

## Product lifecycle

```text
Discovered candidate
  -> operator accepts or rejects
  -> evidence sources imported
  -> extracted claims verified or rejected
  -> deterministic assessment created
  -> assessment approved or returned for changes
  -> approved report snapshot published
  -> product becomes stale when evidence expires or changes
```

Never promote a product because its trend score is high. Trend is a discovery-priority signal only.

## Quarterly publication checklist

1. Set the quarter evidence cutoff explicitly.
2. Complete the discovery scan before the cutoff.
3. Resolve duplicate candidates and exact product versions.
4. Verify important specifications against manufacturer sources.
5. Require independent evidence for experiential claims.
6. Resolve or disclose conflicting evidence.
7. Confirm every assessment uses the intended rubric version.
8. Review fit and confidence independently.
9. Approve the exact assessment IDs included in the report.
10. Publish an immutable snapshot.
11. Export and visually review the complete Webflow HTML embed.
12. Publish in Webflow only with explicit user approval.

## Model evaluation

Before changing the extraction model, run the same labeled evidence set through both models. Compare:

- product/version matching
- atomic claim accuracy
- excerpt fidelity
- rubric-dimension classification
- schema success rate
- human correction rate
- tokens and cost per accepted source

Choose the least expensive model that clears the accuracy threshold. Model aliases should not be changed silently during an active quarterly run.

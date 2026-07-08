## DNS Zone Activation

`ensure-dns-zone.ts` checks that the app's DNS zone is hosted on Scaleway DNS
before the Pulumi DNS and load-balancer modules create records.

When the domain is registered elsewhere, Scaleway zone activation requires two
manual changes at the current DNS provider:

- Add the TXT challenge record Scaleway sends for `_scaleway-challenge.<domain>`.
- Delegate the domain NS records to `ns0.dom.scw.cloud` and `ns1.dom.scw.cloud`.

The helper lists DNS zones, returns when the apex zone is active, creates a
registration when missing, and polls on operator prompt until validation is
complete.

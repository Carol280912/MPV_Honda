# AutoCare customer MVP demo

A responsive customer web application based on the supplied specification and Stitch references.

## Run

From this directory run `python3 -m http.server 4173 --bind 127.0.0.1`, then open http://127.0.0.1:4173.

No build step or package installation is required. Fonts fall back to system sans-serif if the network is unavailable.

## Implemented

Dashboard, vehicle switching, service booking, rescheduling, cancellation, calendar export, repair requests, quotation approval/decline, configurable-in-code demo rewards, voucher redemption, simulated payment outcomes, single-posting points, demo document downloads, history, feedback, preferences, supporting request forms and mobile navigation. State is saved to localStorage under `autocare-v1`.

## Boundaries

This is an interactive frontend demo, not a production system. No authentication, server authorisation, tenant isolation, real payments, live appointment availability, document security, media storage or dealer integration is implemented. Never enter actual customer data. Uploaded image names only are retained. Financial examples and dealer information are fictional. Data can be reset by deleting the localStorage key.

## Next production milestone

Replace local state with authenticated APIs and relational persistence; enforce vehicle ownership and tenant access server-side; implement transaction-safe booking and loyalty ledgers; configure dealer operations and approved provider adapters. Confirm tax, reward, payment, consent and retention rules with the pilot dealer.

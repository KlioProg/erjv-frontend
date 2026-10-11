# Sales confirmation and outgoing fulfillment handoff

## Product goal

**Allow sales orders to be confirmed without warehouse selection, then assign warehouse sources when preparing Outgoing Delivery.**

1. Enter the customer, products, quantities, prices and order details.
2. Choose Save Draft or Confirm Order. Neither action asks for a warehouse.
3. After confirmation, show Order confirmed at the top right. Prepare delivery later through the order list's Outgoing Deliveries action.
4. In Outgoing Delivery, choose warehouse sources and shipment quantities for the confirmed order.
5. Continue through the existing scheduling, dispatch and completion actions.

The confirmed order remains available in the list for fulfillment afterward. Confirmation does not automatically create a shipment. Purchases follow the same separation: purchase details in the order, receiving destination in Incoming Delivery.

## Backend developer handoff

The current backend supports creating a sales draft without allocations, but confirmation requires every item to be fully allocated. Outgoing creation requires existing `salesOrderAllocationId` values. There is no supported endpoint to assign those sources later.

Required capabilities:

- Confirm a valid non-empty sales draft without warehouse allocations, preserving customer information, quantities, prices, discounts and taxes.
- Prepare an outgoing delivery from the confirmed order's remaining items, allowing explicit source selection at that point. Support split fulfillment across warehouses without duplicating the purchased product line.
- Persist source assignments through a supported server operation. Publish the request/response contract so the frontend can submit order-item identity, selected sources and exact shipment quantities without requiring allocations created during order entry.
- Validate source/product identity, available stock, order status and remaining fulfillment quantities on the server. Concurrent requests must not oversell stock or arrange the same balance twice.
- Define reservation timing and cancellation release behavior for the new workflow. Preserve physical stock movement at the existing fulfillment transition and compatibility with previously allocated orders. Do not reserve the same stock twice.

Endpoint design, schema requirements and reservation implementation belong to the backend developer. No new API contract or inventory behavior is claimed to exist in this handoff.

## Frontend completion after the contract is available

- Enable source-free sales Confirm Order using the shared create-then-confirm flow, including saved-draft confirmation retries.
- Update Outgoing Delivery preparation to list remaining order items before sources are assigned, then submit explicit source selections through the supported contract.
- Retain duplicate-request guards, meaningful API errors, exact decimal quantities and existing permissions. Show confirmation success only after the server confirms it.
- Keep both order composers free of warehouse controls. Keep source choices visible in delivery preparation; never invent a default source or simulate successful fulfillment.

## Acceptance checks

- A new sales order confirms without source selection; its saved status remains Confirmed after reload.
- Confirmation shows a notification and creates no delivery; the order remains available for later fulfillment.
- Outgoing Deliveries opens the correct order context; scheduling remains an explicit action in Deliveries.
- Warehouse/source selection happens in outgoing preparation and persists after reload.
- Partial and split shipments respect remaining order quantities and stock availability.
- Confirmation failure retains the saved draft ID; retry creates no duplicate order.
- Delivery/source failures retain entered choices. Concurrent requests and cancellation follow the published reservation rules.
- Existing allocated orders remain usable, and the purchase/incoming workflow still works.

## Current status

At the designer's latest request, compact source controls have been restored in the sales composer to support confirmation with the existing backend. Set stock source expands an inline editor; selected sources collapse to a short summary. Save Draft may omit sources, while Confirm Order requires complete explicit allocations. Confirmation now uses one top-right success notification; the success popup is removed and fulfillment navigation remains an explicit list action. The source-free fulfillment architecture above remains a future backend change, not the current implemented behavior.

Backend files remain untouched. This handoff does not claim live end-to-end verification.

# Unified BOM rules

Each per-position BOM is derived from the corresponding family calculator's returned positions. Quantities are multiplied by the order-line quantity using rational arithmetic. A value absent from a family result stays absent.

The order BOM consolidates rows only when family, SKU, unit, normalized source formula address, and price-source identity agree. Line/Zigzag sheet slot numbers are normalized only for the same cell address (for example `L1!O49` and `L2!O49`); the output retains all source cells, source position IDs, and trace-step IDs. Different families, units, source rows, or price sources are never merged.

Available unit prices and amounts are carried from family outputs and extended by the line quantity. `sharedResources` separately reports source-derived consumable quantities and procurement pack counts; it is not added into the commercial total. Line+Zigzag reuses the existing mixed-order coordinator. Other combinations retain BOM and shared-resource output but remain PARTIAL until the factors are passed into each family commercial formula and the Main-sheet transfer is independently verified. This prevents double charging.

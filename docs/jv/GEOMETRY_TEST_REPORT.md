# Geometry tests

The only implemented business formula is L1 I27; test report in this PR distinguishes unit-test arithmetic from Excel parity. Expected values use independent arithmetic on the sourced expression and are not Excel goldens. I25/I26 and material cuts remain unimplemented pending complete inputs/units. Run `pnpm --filter @bms/shared test:jv`. Excel oracle tests: none.

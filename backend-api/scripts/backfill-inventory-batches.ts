import "dotenv/config";
import { pool } from "@/db";

async function main() {
  const result = await pool.query(`
    with batch_totals as (
      select outlet_id, sku_id, coalesce(sum(on_hand_base_qty), 0)::numeric as batch_qty
      from inventory_batch
      group by outlet_id, sku_id
    ), missing as (
      select
        o.organization_id,
        ib.outlet_id,
        ib.sku_id,
        (ib.on_hand_base_qty::numeric - coalesce(bt.batch_qty, 0)) as delta,
        s.cost
      from inventory_balance ib
      join outlet o on o.id = ib.outlet_id
      join sku s on s.id = ib.sku_id
      left join batch_totals bt on bt.outlet_id = ib.outlet_id and bt.sku_id = ib.sku_id
      where ib.on_hand_base_qty::numeric > coalesce(bt.batch_qty, 0)
    )
    insert into inventory_batch (
      organization_id,
      outlet_id,
      sku_id,
      lot_code,
      initial_base_qty,
      on_hand_base_qty,
      unit_cost,
      source_type,
      note
    )
    select
      organization_id,
      outlet_id,
      sku_id,
      'LEGACY-BALANCE-' || to_char(now(), 'YYYYMMDDHH24MISS'),
      delta::numeric(18,3),
      delta::numeric(18,3),
      cost,
      'legacy_balance_backfill',
      'Backfill batch dari saldo inventory_balance lama'
    from missing
    where delta > 0
    returning id
  `);

  console.log(`Backfilled ${result.rowCount ?? 0} inventory batch row(s).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });

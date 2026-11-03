import { PrismaClient } from '@prisma/client'
import { writeFileSync } from 'fs'

const p = new PrismaClient()

const systems = await p.glazingSystem.findMany({
  include: {
    parameters: { include: { limits: true } },
    components: true,
    categories: true,
    glasses: true,
  }
})

console.log(`Exporting ${systems.length} systems...`)
writeFileSync('systems-export.json', JSON.stringify(systems, null, 2))
console.log('Saved to systems-export.json')

await p.$disconnect()

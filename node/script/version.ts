import { VERSION_MODULE, readSchemaVersion, renderVersionModule } from './utils'

import { writeFileSync } from 'node:fs'

/**
 * Regenerates the module that carries the declared schema version into the bindings.
 */
const main = () => {
  const schema = readSchemaVersion()

  writeFileSync(VERSION_MODULE, renderVersionModule(schema))
  console.log(`schema ${schema} -> src/version.ts`)
}

main()

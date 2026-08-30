import { database, type OctaReaderDatabase } from '@/data/database'

export class LocalDataService {
  constructor(private readonly db: OctaReaderDatabase = database) {}

  async clearAll(): Promise<void> {
    await this.db.transaction('rw', this.db.tables, async () => {
      await Promise.all(this.db.tables.map((table) => table.clear()))
    })
  }
}

export const localDataService = new LocalDataService()

import { database, type OctaReaderDatabase } from '@/data/database'
import type {
  ReviewSchedule,
  VocabularyContext,
  VocabularyEntry,
} from '@/data/models'
import type { PartOfSpeech } from '@/domain/ai/provider'
import { normalizeLanguageCode } from '@/domain/languages'

export type SaveVocabularyInput = {
  sourceText: string
  lemma: string | null
  partOfSpeech: PartOfSpeech
  translation: string
  sentence: string | null
  sourceLanguage: string
  targetLanguage: string
  bookId: string
  bookTitle: string
  cfi: string | null
}

export type VocabularyListItem = VocabularyEntry & {
  contexts: VocabularyContext[]
}

const normalizeIdentityPart = (value: string): string =>
  value.normalize('NFKC').trim().toLocaleLowerCase()

const normalizeLanguageIdentity = (value: string): string =>
  normalizeLanguageCode(value) ?? normalizeIdentityPart(value)

export const vocabularyIdentityKey = (
  lemmaOrSourceText: string,
  partOfSpeech: PartOfSpeech,
  sourceLanguage: string,
  targetLanguage: string,
): string =>
  JSON.stringify([
    normalizeIdentityPart(lemmaOrSourceText),
    partOfSpeech,
    normalizeLanguageIdentity(sourceLanguage),
    normalizeLanguageIdentity(targetLanguage),
  ])

const sameContext = (
  context: VocabularyContext,
  input: SaveVocabularyInput,
): boolean =>
  context.sourceText === input.sourceText &&
  context.translation === input.translation &&
  context.sentence === input.sentence &&
  context.bookId === input.bookId &&
  context.cfi === input.cfi

export class VocabularyService {
  constructor(private readonly db: OctaReaderDatabase = database) {}

  async save(input: SaveVocabularyInput): Promise<VocabularyEntry> {
    const lemma = input.lemma?.trim() || input.sourceText.trim()
    const sourceLanguage =
      normalizeLanguageCode(input.sourceLanguage) ?? input.sourceLanguage
    const targetLanguage =
      normalizeLanguageCode(input.targetLanguage) ?? input.targetLanguage
    const identityKey = vocabularyIdentityKey(
      lemma,
      input.partOfSpeech,
      sourceLanguage,
      targetLanguage,
    )

    return this.db.transaction(
      'rw',
      [
        this.db.vocabularyEntries,
        this.db.vocabularyContexts,
        this.db.reviewSchedules,
      ],
      async () => {
        const now = Date.now()
        let entry = await this.db.vocabularyEntries
          .where('identityKey')
          .equals(identityKey)
          .first()

        if (entry === undefined) {
          entry = {
            id: crypto.randomUUID(),
            identityKey,
            lemma,
            partOfSpeech: input.partOfSpeech,
            sourceLanguage,
            targetLanguage,
            createdAt: now,
            updatedAt: now,
          }
          const schedule: ReviewSchedule = {
            vocabularyEntryId: entry.id,
            intervalDays: 0,
            dueAt: now,
            lastReviewedAt: null,
            reviewCount: 0,
            lapseCount: 0,
          }
          await this.db.vocabularyEntries.add(entry)
          await this.db.reviewSchedules.add(schedule)
        }

        const contexts = await this.db.vocabularyContexts
          .where('vocabularyEntryId')
          .equals(entry.id)
          .toArray()
        if (!contexts.some((context) => sameContext(context, input))) {
          await this.db.vocabularyContexts.add({
            id: crypto.randomUUID(),
            vocabularyEntryId: entry.id,
            sourceText: input.sourceText,
            translation: input.translation,
            sentence: input.sentence,
            bookId: input.bookId,
            bookTitle: input.bookTitle,
            cfi: input.cfi,
            createdAt: now,
          })
          entry = { ...entry, updatedAt: now }
          await this.db.vocabularyEntries.put(entry)
        }

        return entry
      },
    )
  }

  async list(): Promise<VocabularyListItem[]> {
    const entries = await this.db.vocabularyEntries
      .orderBy('updatedAt')
      .reverse()
      .toArray()
    const contexts = await this.db.vocabularyContexts.toArray()
    return entries.map((entry) => ({
      ...entry,
      contexts: contexts
        .filter((context) => context.vocabularyEntryId === entry.id)
        .sort((left, right) => right.createdAt - left.createdAt),
    }))
  }

  async delete(entryId: string): Promise<void> {
    await this.db.transaction(
      'rw',
      [
        this.db.vocabularyEntries,
        this.db.vocabularyContexts,
        this.db.reviewSchedules,
        this.db.reviewEvents,
      ],
      async () => {
        await this.db.vocabularyContexts
          .where('vocabularyEntryId')
          .equals(entryId)
          .delete()
        await this.db.reviewEvents
          .where('vocabularyEntryId')
          .equals(entryId)
          .delete()
        await this.db.reviewSchedules.delete(entryId)
        await this.db.vocabularyEntries.delete(entryId)
      },
    )
  }
}

export const vocabularyService = new VocabularyService()

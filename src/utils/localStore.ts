import { TestMetadata, Question, UserProgress } from '../types';

const KEYS = {
  tests: 'medtest_local_tests',
  questions: (testId: string) => `medtest_local_questions_${testId}`,
  progress: 'medtest_local_progress',
};

// ── Tests ──────────────────────────────────────────────────────────────────

export function localGetTests(userId: string): TestMetadata[] {
  try {
    const raw = localStorage.getItem(KEYS.tests);
    const all: TestMetadata[] = raw ? JSON.parse(raw) : [];
    return all.filter(t => t.createdBy === userId);
  } catch {
    return [];
  }
}

export function localSaveTest(meta: TestMetadata): void {
  try {
    const raw = localStorage.getItem(KEYS.tests);
    const all: TestMetadata[] = raw ? JSON.parse(raw) : [];
    const idx = all.findIndex(t => t.id === meta.id);
    if (idx >= 0) all[idx] = meta; else all.push(meta);
    localStorage.setItem(KEYS.tests, JSON.stringify(all));
  } catch (e) {
    console.error('localStore: failed to save test', e);
  }
}

export function localUpdateTest(testId: string, patch: Partial<TestMetadata>): void {
  try {
    const raw = localStorage.getItem(KEYS.tests);
    const all: TestMetadata[] = raw ? JSON.parse(raw) : [];
    const idx = all.findIndex(t => t.id === testId);
    if (idx >= 0) {
      all[idx] = { ...all[idx], ...patch };
      localStorage.setItem(KEYS.tests, JSON.stringify(all));
    }
  } catch (e) {
    console.error('localStore: failed to update test', e);
  }
}

export function localDeleteTest(testId: string): void {
  try {
    const raw = localStorage.getItem(KEYS.tests);
    const all: TestMetadata[] = raw ? JSON.parse(raw) : [];
    localStorage.setItem(KEYS.tests, JSON.stringify(all.filter(t => t.id !== testId)));
    localStorage.removeItem(KEYS.questions(testId));
  } catch (e) {
    console.error('localStore: failed to delete test', e);
  }
}

export function localGetTest(testId: string): TestMetadata | null {
  try {
    const raw = localStorage.getItem(KEYS.tests);
    const all: TestMetadata[] = raw ? JSON.parse(raw) : [];
    return all.find(t => t.id === testId) ?? null;
  } catch {
    return null;
  }
}

// ── Questions ──────────────────────────────────────────────────────────────

export function localSaveQuestions(testId: string, questions: Question[]): void {
  try {
    localStorage.setItem(KEYS.questions(testId), JSON.stringify(questions));
  } catch (e) {
    console.error('localStore: failed to save questions', e);
  }
}

export function localGetQuestions(testId: string): Question[] {
  try {
    const raw = localStorage.getItem(KEYS.questions(testId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// ── Progress ───────────────────────────────────────────────────────────────

function getAllProgress(): Record<string, UserProgress> {
  try {
    const raw = localStorage.getItem(KEYS.progress);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function localGetProgress(userId: string): UserProgress[] {
  const all = getAllProgress();
  return Object.values(all).filter(p => p.userId === userId);
}

export function localGetTestProgress(testId: string, userId: string): UserProgress | null {
  const all = getAllProgress();
  return all[`${testId}_${userId}`] ?? null;
}

export function localSaveProgress(progress: UserProgress): void {
  try {
    const all = getAllProgress();
    all[progress.id] = progress;
    localStorage.setItem(KEYS.progress, JSON.stringify(all));
  } catch (e) {
    console.error('localStore: failed to save progress', e);
  }
}

export function localDeleteProgress(testId: string, userId: string): void {
  try {
    const all = getAllProgress();
    delete all[`${testId}_${userId}`];
    localStorage.setItem(KEYS.progress, JSON.stringify(all));
  } catch (e) {
    console.error('localStore: failed to delete progress', e);
  }
}

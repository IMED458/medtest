import { Question, ValidationIssue, ValidationReport } from '../types';

/**
 * Normalizes Georgian and Latin characters to facilitate searching/comparison
 * by mapping standard typographical quirks.
 */
export function normalizeText(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacritics
    .replace(/\s+/g, ' ') // standard space boundaries
    .trim();
}

/**
 * Parses raw text into a standard array of questions while generating validation reports
 */
export function parseTextToQuestions(text: string): { 
  questions: Omit<Question, 'id' | 'testId'>[]; 
  report: ValidationReport;
} {
  const lines = text.split('\n');
  const questions: Omit<Question, 'id' | 'testId'>[] = [];
  const issues: ValidationIssue[] = [];

  let currentQuestionText = '';
  let currentOptions: string[] = [];
  let currentCorrectIndex = -1;
  let correctCountForCurrent = 0;
  let parsedQuestionCount = 0;

  function pushCurrent() {
    parsedQuestionCount++;
    const questionTextTrimmed = currentQuestionText.trim();
    const optSize = currentOptions.length;
    let localIssuesCount = 0;

    // 1. Check if the question text is empty
    if (!questionTextTrimmed) {
      issues.push({
        questionNumber: parsedQuestionCount,
        issueType: 'empty_question',
        message: 'კითხვის ტექსტი ცარიელია ან არასწორია'
      });
      localIssuesCount++;
    }

    // 2. Check options size
    if (optSize === 0) {
      issues.push({
        questionNumber: parsedQuestionCount,
        questionText: questionTextTrimmed || '(ცარიელი)',
        issueType: 'no_answers',
        message: 'კითხვას არ გააჩნია პასუხები'
      });
      localIssuesCount++;
    } else {
      // 3. Check correct answers quantity
      if (correctCountForCurrent === 0) {
        issues.push({
          questionNumber: parsedQuestionCount,
          questionText: questionTextTrimmed,
          issueType: 'missing_correct',
          message: 'სწორი პასუხი ვერ მოიძებნა (გამოიყენეთ // სწორი პასუხისთვის)'
        });
        localIssuesCount++;
      } else if (correctCountForCurrent > 1) {
        issues.push({
          questionNumber: parsedQuestionCount,
          questionText: questionTextTrimmed,
          issueType: 'multiple_correct',
          message: `კითხვაში ნაპოვნია ${correctCountForCurrent} სწორი პასუხი`
        });
        localIssuesCount++;
      }
    }

    // 4. Duplicate checks
    const lowercaseQuestion = normalizeText(questionTextTrimmed);
    const isDuplicate = questions.some(q => normalizeText(q.questionText) === lowercaseQuestion);
    if (isDuplicate && questionTextTrimmed) {
      issues.push({
        questionNumber: parsedQuestionCount,
        questionText: questionTextTrimmed,
        issueType: 'duplicate_question',
        message: 'დუბლიკატი კითხვა'
      });
      localIssuesCount++;
    }

    // Capture standard question (fallback index 0 if not found)
    questions.push({
      questionText: questionTextTrimmed || `კითხვა #${parsedQuestionCount}`,
      options: currentOptions.map(opt => opt.trim()),
      correctOptionIndex: currentCorrectIndex !== -1 ? currentCorrectIndex : 0,
      originalIndex: parsedQuestionCount
    });

    // Reset status trackers
    currentQuestionText = '';
    currentOptions = [];
    currentCorrectIndex = -1;
    correctCountForCurrent = 0;
  }

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    // Skip empty spacing lines outside of questions
    if (!line && !currentQuestionText) continue;

    if (line.startsWith('////')) {
      if (currentQuestionText || currentOptions.length > 0) {
        pushCurrent();
      }
      currentQuestionText = rawLine.substring(rawLine.indexOf('////') + 4);
    } else if (line.startsWith('///')) {
      currentOptions.push(rawLine.substring(rawLine.indexOf('///') + 3));
    } else if (line.startsWith('//')) {
      currentCorrectIndex = currentOptions.length;
      currentOptions.push(rawLine.substring(rawLine.indexOf('//') + 2));
      correctCountForCurrent++;
    } else if (line && currentQuestionText) {
      // Multiline support for question text
      currentQuestionText += ' ' + rawLine;
    }
  }

  // Handle final lingering questions
  if (currentQuestionText || currentOptions.length > 0) {
    pushCurrent();
  }

  const problematicQuestions = Array.from(new Set(issues.map(iss => iss.questionNumber))).length;
  const correctQuestions = questions.length - problematicQuestions;

  const report: ValidationReport = {
    totalQuestions: questions.length,
    correctQuestions,
    problematicQuestions,
    issues
  };

  return { questions, report };
}


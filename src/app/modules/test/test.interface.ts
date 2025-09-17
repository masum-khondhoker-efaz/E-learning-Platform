export interface IOption {
    questionId?: string;
    text: string;
    isCorrect?: boolean;
    order: number;
}

export interface IAnswer {
    id?: string;
    questionId?: string;
    text: string;
    isCorrect?: boolean;
}

export type QuestionType = "MCQ" | "TRUE_FALSE" | "SHORT_ANSWER";

export interface IQuestion {
    testId?: string;
    title: string;
    description?: string;
    type: QuestionType;
    marks?: number;
    explanation?: string;
    order?: number;
    isActive?: boolean;
    options?: IOption[];
    answers?: IAnswer[];
}

export interface ITest {
    courseId: string;
    title: string;
    description?: string;
    passingScore?: number;
    totalMarks?: number;
    timeLimit?: number;
    isActive?: boolean;
    isPublished?: boolean;
    questions: IQuestion[];
}

export interface ITestUpdate {
    courseId?: string;
    title?: string;
    description?: string;
    passingScore?: number;
    totalMarks?: number;
    timeLimit?: number;
    isActive?: boolean;
    isPublished?: boolean;
    questions?: IQuestion[];
}
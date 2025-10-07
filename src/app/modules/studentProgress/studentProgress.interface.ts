export interface Lesson {
    id: string;
    title: string;
    order: number;
  }

export  interface Test {
    id: string;
    title: string;
    order: number;
  }

export  interface Section {
    id: string;
    title: string;
    order: number;
    Lesson: Lesson[];
    Test: Test[];
  }

export  interface Course {
    id: string;
    courseTitle: string;
    Section: Section[];
  }

  export interface StudentProgress {
    id: string;
    userId: string;
    courseId: string;
    sectionId: string;
    lessonId: string;
    isCompleted: boolean;
    updatedAt: Date;
  }
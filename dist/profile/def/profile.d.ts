import { ServerProfile } from './server-profile';
export declare enum ProfileType {
    STUDENT = "student",
    TEACHER = "teacher"
}
export declare enum ProfileSource {
    SERVER = "server",
    LOCAL = "local"
}
export interface Profile {
    uid: string;
    handle: string;
    created_at: number;
    medium: string[];
    board: string[];
    subject: string[];
    profile_type: ProfileType;
    grade: string[];
    syllabus: string[];
    source: ProfileSource;
    grade_value: {
        [key: string]: any;
    };
    serverProfile?: ServerProfile;
}
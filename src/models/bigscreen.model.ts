import { Competition } from "./competition.model";
import { ScreenGroup } from "./screengroup.model";

export type BigScreen = {
    id: number;
    role: string;
    clientId?: string;
    screenGroupId?: number;
    competitionId?: number;

    screenGroup?: ScreenGroup;
    competition?: Competition;
}
export interface ReversalAction {
    originalLogId: string;
    command: string;
    reason: string;
}

export class RollbackService {
    /**
     * Analyzes logs and generates a list of reversal commands.
     * @param logs List of log entries to analyze
     */
    public calculateReversals(logs: { id: string; command: string }[]): ReversalAction[] {
        const reversals: ReversalAction[] = [];

        for (const log of logs) {
            if (!log.command) continue;

            const parts = log.command.split(" ");
            const cmd = parts[0].toLowerCase();
            const target = parts[1];

            if (!target) continue;

            // Reject targets that don't look like valid Roblox usernames
            if (!/^[a-zA-Z0-9_]{3,20}$/.test(target)) continue;

            if (cmd === ":ban") {
                reversals.push({
                    originalLogId: log.id,
                    command: `:unban ${target}`,
                    reason: `Rollback of ${log.command}`
                });
            } else if (cmd === ":unban") {
                reversals.push({
                    originalLogId: log.id,
                    command: `:ban ${target}`,
                    reason: `Rollback of ${log.command}`
                });
            } else if (cmd === ":unadmin") {
                reversals.push({
                    originalLogId: log.id,
                    command: `:admin ${target}`,
                    reason: `Rollback of ${log.command}`
                });
            } else if (cmd === ":unmod") {
                reversals.push({
                    originalLogId: log.id,
                    command: `:mod ${target}`,
                    reason: `Rollback of ${log.command}`
                });
            }
        }

        return reversals;
    }
}

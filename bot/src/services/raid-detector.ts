export type DetectionType = "HIGH_FREQUENCY" | "MASS_ACTION" | "UNAUTHORIZED";

export interface Detection {
    type: DetectionType;
    userId: string;
    userName: string;
    details: string;
    pattern?: string;
}

export class RaidDetectorService {
    private sensitiveCommands = [":ban", ":kick", ":kill", ":unadmin", ":unmod", ":down"];
    private massActionPatterns = [/all\b/i, /others\b/i];

    /**
     * Scans a batch of logs for raid patterns.
     * @param logs The logs to scan.
     * @param authorizedMemberIds Optional list of Discord/Roblox IDs that are allowed to run commands.
     * @returns A list of detections found.
     */
    public scan(logs: any[], authorizedMemberIds?: string[]): Detection[] {
        const detections: Detection[] = [];
        
        // 1. Detect Mass Actions
        detections.push(...this.detectMassActions(logs));
        
        // 2. Detect High Frequency
        detections.push(...this.detectHighFrequency(logs));

        // 3. Detect Unauthorized Commands
        if (authorizedMemberIds) {
            detections.push(...this.detectUnauthorized(logs, authorizedMemberIds));
        }

        return detections;
    }

    private detectUnauthorized(logs: any[], authorizedMemberIds: string[]): Detection[] {
        const detections: Detection[] = [];
        for (const log of logs) {
            if (!log.playerId || !log.command) continue;

            const isSensitive = this.sensitiveCommands.some(cmd => log.command.toLowerCase().startsWith(cmd));
            if (!isSensitive) continue;

            if (!authorizedMemberIds.includes(log.playerId)) {
                detections.push({
                    type: "UNAUTHORIZED",
                    userId: log.playerId,
                    userName: log.playerName || "Unknown",
                    details: `Unauthorized command execution: ${log.command}`,
                    pattern: log.command
                });
            }
        }
        return detections;
    }

    private detectMassActions(logs: any[]): Detection[] {
        const massDetections: Detection[] = [];
        for (const log of logs) {
            if (!log.command) continue;
            
            const isSensitive = this.sensitiveCommands.some(cmd => log.command.toLowerCase().startsWith(cmd));
            if (!isSensitive) continue;

            const isMass = this.massActionPatterns.some(pattern => pattern.test(log.command));
            if (isMass) {
                massDetections.push({
                    type: "MASS_ACTION",
                    userId: log.playerId,
                    userName: log.playerName || "Unknown",
                    details: `Mass action detected: ${log.command}`,
                    pattern: log.command
                });
            }
        }
        return massDetections;
    }

    private detectHighFrequency(logs: any[]): Detection[] {
        const highFreqDetections: Detection[] = [];
        const userCommands: Record<string, any[]> = {};

        // Group logs by user
        for (const log of logs) {
            if (!log.playerId || !log.command || !log.prcTimestamp) continue;
            
            const isSensitive = this.sensitiveCommands.some(cmd => log.command.toLowerCase().startsWith(cmd));
            if (!isSensitive) continue;

            if (!userCommands[log.playerId]) {
                userCommands[log.playerId] = [];
            }
            userCommands[log.playerId].push(log);
        }

        // Check frequency per user
        for (const userId in userCommands) {
            const commands = userCommands[userId].sort((a, b) => b.prcTimestamp - a.prcTimestamp);
            
            // Check for > 5 commands in 10 seconds
            let right = 0;
            for (let left = 0; left < commands.length; left++) {
                const windowStart = commands[left].prcTimestamp;

                while (right < commands.length && commands[right].prcTimestamp > windowStart - 10) {
                    right++;
                }

                let start = left;
                while (start > 0 && commands[start - 1].prcTimestamp === windowStart) {
                    start--;
                }

                const count = right - start;
                if (count > 5) {
                    const windowCommands = commands.slice(start, right);
                    highFreqDetections.push({
                        type: "HIGH_FREQUENCY",
                        userId: userId,
                        userName: commands[left].playerName || "Unknown",
                        details: `High frequency detected: ${windowCommands.length} commands in 10 seconds`,
                        pattern: windowCommands.map(c => c.command).join(", ")
                    });
                    break; // Only one detection per user per batch for now
                }
            }
        }

        return highFreqDetections;
    }
}

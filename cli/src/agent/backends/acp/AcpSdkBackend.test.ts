import { afterEach, describe, expect, it } from 'vitest';
import type { AgentMessage } from '@/agent/types';
import { AcpSdkBackend } from './AcpSdkBackend';
import { ACP_SESSION_UPDATE_TYPES } from './constants';

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

type BackendStatics = {
    UPDATE_QUIET_PERIOD_MS: number;
    UPDATE_DRAIN_TIMEOUT_MS: number;
    PRE_PROMPT_UPDATE_QUIET_PERIOD_MS: number;
    PRE_PROMPT_UPDATE_DRAIN_TIMEOUT_MS: number;
};

const backendStatics = AcpSdkBackend as unknown as BackendStatics;
const originalStatics = {
    updateQuietPeriodMs: backendStatics.UPDATE_QUIET_PERIOD_MS,
    updateDrainTimeoutMs: backendStatics.UPDATE_DRAIN_TIMEOUT_MS,
    prePromptUpdateQuietPeriodMs: backendStatics.PRE_PROMPT_UPDATE_QUIET_PERIOD_MS,
    prePromptUpdateDrainTimeoutMs: backendStatics.PRE_PROMPT_UPDATE_DRAIN_TIMEOUT_MS
};

afterEach(() => {
    backendStatics.UPDATE_QUIET_PERIOD_MS = originalStatics.updateQuietPeriodMs;
    backendStatics.UPDATE_DRAIN_TIMEOUT_MS = originalStatics.updateDrainTimeoutMs;
    backendStatics.PRE_PROMPT_UPDATE_QUIET_PERIOD_MS = originalStatics.prePromptUpdateQuietPeriodMs;
    backendStatics.PRE_PROMPT_UPDATE_DRAIN_TIMEOUT_MS = originalStatics.prePromptUpdateDrainTimeoutMs;
});

describe('AcpSdkBackend', () => {
    it('emits turn_complete after trailing tool updates from the same turn', async () => {
        backendStatics.UPDATE_QUIET_PERIOD_MS = 30;
        backendStatics.UPDATE_DRAIN_TIMEOUT_MS = 1000;
        backendStatics.PRE_PROMPT_UPDATE_QUIET_PERIOD_MS = 1;
        backendStatics.PRE_PROMPT_UPDATE_DRAIN_TIMEOUT_MS = 50;

        const backend = new AcpSdkBackend({ command: 'opencode' });
        const backendInternal = backend as unknown as {
            transport: {
                sendRequest: (...args: unknown[]) => Promise<unknown>;
                close: () => Promise<void>;
            } | null;
            handleSessionUpdate: (params: unknown) => void;
        };

        const messages: AgentMessage[] = [];
        backendInternal.transport = {
            sendRequest: async () => {
                setTimeout(() => {
                    backendInternal.handleSessionUpdate({
                        sessionId: 'session-1',
                        update: {
                            sessionUpdate: ACP_SESSION_UPDATE_TYPES.agentMessageChunk,
                            content: { type: 'text', text: 'final answer' }
                        }
                    });
                }, 0);

                await sleep(5);

                setTimeout(() => {
                    backendInternal.handleSessionUpdate({
                        sessionId: 'session-1',
                        update: {
                            sessionUpdate: ACP_SESSION_UPDATE_TYPES.toolCall,
                            toolCallId: 'tool-1',
                            title: 'Read',
                            rawInput: { path: 'README.md' },
                            status: 'in_progress'
                        }
                    });
                }, 3);

                setTimeout(() => {
                    backendInternal.handleSessionUpdate({
                        sessionId: 'session-1',
                        update: {
                            sessionUpdate: ACP_SESSION_UPDATE_TYPES.toolCallUpdate,
                            toolCallId: 'tool-1',
                            status: 'completed',
                            rawOutput: { ok: true }
                        }
                    });
                }, 6);

                return { stopReason: 'end_turn' };
            },
            close: async () => {}
        };

        await backend.prompt('session-1', [{ type: 'text', text: 'hello' }], (message) => {
            messages.push(message);
        });

        expect(messages.map((message) => message.type)).toEqual([
            'tool_call',
            'tool_result',
            'text',
            'turn_complete'
        ]);
    });

    it('resolves permission requests even when responded immediately', async () => {
        const backend = new AcpSdkBackend({ command: 'opencode' });
        backend.onPermissionRequest((request) => {
            void backend.respondToPermission(request.sessionId, request, {
                outcome: 'selected',
                optionId: 'allow_once'
            });
        });

        const backendInternal = backend as unknown as {
            handlePermissionRequest: (params: unknown, requestId: string | number | null) => Promise<unknown>;
        };

        const params = {
            sessionId: 'session-1',
            toolCall: {
                toolCallId: 'tool-1',
                title: 'Run',
                kind: 'run_shell_command',
                rawInput: { command: 'echo hello' }
            },
            options: [
                { optionId: 'allow_once', name: 'Allow once', kind: 'allow_once' }
            ]
        };

        const resultOrTimeout = await Promise.race([
            backendInternal.handlePermissionRequest(params, null),
            sleep(200).then(() => 'timeout' as const)
        ]);

        expect(resultOrTimeout).not.toBe('timeout');
        expect(resultOrTimeout).toEqual({
            outcome: {
                outcome: 'selected',
                optionId: 'allow_once'
            }
        });
    });
});

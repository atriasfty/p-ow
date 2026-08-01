import { PrcClient, PrcInvalidKeyError } from "./prc"

jest.mock("./config", () => ({
    getGlobalConfig: jest.fn().mockResolvedValue("https://api.erlc.gg/v2"),
}))

jest.mock("./metrics", () => ({
    trackApiCall: jest.fn(),
}))

function mockFetchOnce(status: number, body: Record<string, unknown> = {}) {
    return jest.fn().mockResolvedValueOnce({
        ok: status >= 200 && status < 300,
        status,
        headers: new Headers(),
        text: async () => JSON.stringify(body),
        json: async () => body,
    }) as unknown as typeof fetch
}

describe("PrcClient invalid-key circuit breaker", () => {
    beforeEach(() => {
        jest.restoreAllMocks()
    })

    it("throws PrcInvalidKeyError on a 403 response", async () => {
        global.fetch = mockFetchOnce(403)

        const client = new PrcClient("some-invalid-key-testkey01")
        await expect(client.getServerV2()).rejects.toBeInstanceOf(PrcInvalidKeyError)
    })

    it("does not make a second network request for the same key after a 403", async () => {
        const fetchMock = mockFetchOnce(403)
        global.fetch = fetchMock

        const client = new PrcClient("another-invalid-key-testkey02")
        await expect(client.getServerV2()).rejects.toBeInstanceOf(PrcInvalidKeyError)

        // Second call should short-circuit before ever calling fetch again
        await expect(client.getServerV2()).rejects.toBeInstanceOf(PrcInvalidKeyError)
        expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it("a different (presumably rotated) key is not affected by another key's 403", async () => {
        global.fetch = mockFetchOnce(403)
        const badClient = new PrcClient("bad-key-testkey03")
        await expect(badClient.getServerV2()).rejects.toBeInstanceOf(PrcInvalidKeyError)

        global.fetch = mockFetchOnce(200, { Name: "Test Server" })
        const goodClient = new PrcClient("good-key-testkey04")
        await expect(goodClient.getServerV2()).resolves.toEqual({ Name: "Test Server" })
    })
})

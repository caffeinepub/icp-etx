import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface PairTrade {
    id: bigint;
    allocationUsd: number;
    createdAt: bigint;
    riskTier: RiskTier;
    tokenAAddress: string;
    tokenASymbol: string;
    routeViaICP: boolean;
    notes: string;
    tokenBAddress: string;
    tokenBSymbol: string;
}
export interface TransformationOutput {
    status: bigint;
    body: Uint8Array;
    headers: Array<http_header>;
}
export interface FundingEntry {
    id: bigint;
    entryType: FundingEntryType;
    note: string;
    timestamp: bigint;
    amountICP: number;
}
export interface SwapReceipt {
    id: string;
    tokenIn: string;
    tokenOut: string;
    amountIn: number;
    realizedPnL: number;
    timestamp: bigint;
    priceImpactPct: number;
    amountOut: number;
    route: string;
}
export interface http_header {
    value: string;
    name: string;
}
export interface http_request_result {
    status: bigint;
    body: Uint8Array;
    headers: Array<http_header>;
}
export interface BasketSlot {
    slotLabel: string;
    targetWeightBps: bigint;
    pairTradeId: bigint;
}
export interface Holding {
    balance: number;
    tokenCanisterId: string;
    costBasis: number;
    symbol: string;
}
export interface TransformationInput {
    context: Uint8Array;
    response: http_request_result;
}
export interface Basket {
    id: bigint;
    rebalanceThresholdBps: bigint;
    name: string;
    createdAt: bigint;
    riskTier: string;
    description: string;
    slots: Array<BasketSlot>;
    updatedAt: bigint;
}
export interface UserProfile {
    riskPreference: string;
    displayName: string;
    preferredCurrency: string;
}
export enum FundingEntryType {
    deposit = "deposit",
    stakingReward = "stakingReward"
}
export enum RiskTier {
    conservative = "conservative",
    aggressive = "aggressive",
    moderate = "moderate"
}
export enum UserRole {
    admin = "admin",
    user = "user",
    guest = "guest"
}
export interface backendInterface {
    addFundingEntry(entryType: FundingEntryType, amountICP: number, note: string): Promise<bigint>;
    assignCallerUserRole(user: Principal, role: UserRole): Promise<void>;
    createBasket(name: string, description: string, slots: Array<BasketSlot>, rebalanceThresholdBps: bigint): Promise<{
        __kind__: "ok";
        ok: bigint;
    } | {
        __kind__: "err";
        err: string;
    }>;
    createPairTrade(tokenAAddress: string, tokenASymbol: string, tokenBAddress: string, tokenBSymbol: string, allocationUsd: number, riskTier: RiskTier, routeViaICP: boolean, notes: string): Promise<bigint>;
    deleteBasket(id: bigint): Promise<boolean>;
    deletePairTrade(id: bigint): Promise<boolean>;
    executeSwap(tokenIn: Principal, amountIn: number, tokenOut: Principal, route: string, priceImpactPct: number): Promise<string>;
    fetchDexScreenerPairs(): Promise<string>;
    fetchICPSwapTokens(): Promise<string>;
    fetchKongSwapTokens(): Promise<string>;
    getTokenUniverseCaches(): Promise<{ dexScreener: string; icpSwap: string; kongSwap: string; updatedAt: bigint }>;
    updateTokenUniverse(): Promise<void>;
    getAvailableICPBalance(): Promise<number>;
    getBasket(id: bigint): Promise<Basket | null>;
    getBasketDrift(basketId: bigint, priceMap: Array<[string, number]>): Promise<Array<{
        direction: string;
        slotIndex: bigint;
        driftBps: bigint;
    }>>;
    getBasketRiskTier(id: bigint): Promise<string | null>;
    getBaskets(): Promise<Array<Basket>>;
    getCallerUserProfile(): Promise<UserProfile | null>;
    getCallerUserRole(): Promise<UserRole>;
    getDecimals(token: Principal): Promise<number>;
    getFundingEntries(): Promise<Array<FundingEntry>>;
    getHolding(tokenCanisterId: string): Promise<Holding | null>;
    getHoldings(): Promise<Array<Holding>>;
    getPairTrade(id: bigint): Promise<PairTrade | null>;
    getPairTrades(): Promise<Array<PairTrade>>;
    getPortfolioValue(priceMap: Array<[string, number]>): Promise<number>;
    getProfile(): Promise<{
        __kind__: "ok";
        ok: {
            riskPreference: string;
            displayName: string;
            preferredCurrency: string;
            ownerPrincipal?: Principal;
        };
    } | {
        __kind__: "err";
        err: string;
    }>;
    getSwapQuote(tokenIn: string, amountIn: number, tokenOut: string): Promise<number>;
    getSwapReceipts(): Promise<Array<SwapReceipt>>;
    getTotalFundedICP(): Promise<number>;
    getTotalRealizedPnL(): Promise<number>;
    getTradeFrequencyCap(riskTier: RiskTier): Promise<bigint>;
    getTradeFrequencyStatus(): Promise<{
        resetsAt: bigint;
        usedThisMonth: bigint;
        pctUsed: bigint;
        limitThisMonth: bigint;
    }>;
    getTradingPermissionExpiry(): Promise<bigint | null>;
    getUnrealizedPnL(priceMap: Array<[string, number]>, icpPriceUsd: number): Promise<number>;
    getUserProfile(user: Principal): Promise<UserProfile | null>;
    grantTradingPermission(): Promise<string>;
    isCallerAdmin(): Promise<boolean>;
    isOwner(): Promise<boolean>;
    revokeTradingPermission(): Promise<string>;
    saveCallerUserProfile(profile: UserProfile): Promise<void>;
    setDecimals(token: Principal, decimals: number): Promise<void>;
    setProfile(name: string, currency: string, risk: string): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    transform(input: TransformationInput): Promise<TransformationOutput>;
    updateBasket(id: bigint, name: string, description: string, slots: Array<BasketSlot>, rebalanceThresholdBps: bigint): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    updateHolding(tokenCanisterId: string, amountChange: number): Promise<void>;
    updatePairTrade(id: bigint, allocationUsd: number, riskTier: RiskTier, notes: string): Promise<boolean>;
    validateBasketSlots(slots: Array<BasketSlot>): Promise<{
        valid: boolean;
        error?: string;
    }>;
}

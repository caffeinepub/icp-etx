import Float "mo:core/Float";
import Nat "mo:core/Nat";
import Nat64 "mo:core/Nat64";
import Time "mo:core/Time";
import Array "mo:core/Array";
import Text "mo:core/Text";
import Int "mo:core/Int";
import Iter "mo:core/Iter";
import Nat8 "mo:core/Nat8";
import Principal "mo:core/Principal";
import Map "mo:core/Map";
import Runtime "mo:core/Runtime";
import Error "mo:core/Error";
import Debug "mo:core/Debug";
import Nat32 "mo:core/Nat32";
import Char "mo:core/Char";
import OutCall "http-outcalls/outcall";
import MixinAuthorization "authorization/MixinAuthorization";
import AccessControl "authorization/access-control";



actor self {
  // ─── External DEX / Ledger Interface Types ─────────────────────────────────

  type Account = { owner : Principal; subaccount : ?Blob };

  type ICRC2TransferFromArgs = {
    spender_subaccount : ?Blob;
    from : Account;
    to : Account;
    amount : Nat;
    fee : ?Nat;
    memo : ?Blob;
    created_at_time : ?Nat64;
  };

  type ICRC2TransferFromError = {
    #GenericError : { error_code : Nat; message : Text };
    #TemporarilyUnavailable;
    #InsufficientAllowance : { allowance : Nat };
    #BadBurn : { min_burn_amount : Nat };
    #Duplicate : { duplicate_of : Nat };
    #BadFee : { expected_fee : Nat };
    #CreatedInFuture : { ledger_time : Nat64 };
    #TooOld;
    #InsufficientFunds : { balance : Nat };
  };

  type ICRC2Ledger = actor {
    icrc2_transfer_from : (ICRC2TransferFromArgs) -> async { #Ok : Nat; #Err : ICRC2TransferFromError };
  };

  type ICRC1TransferArgs = {
    to : Account;
    amount : Nat;
    fee : ?Nat;
    memo : ?Blob;
    from_subaccount : ?Blob;
    created_at_time : ?Nat64;
  };

  type ICRC1TransferError = {
    #BadFee : { expected_fee : Nat };
    #BadBurn : { min_burn_amount : Nat };
    #InsufficientFunds : { balance : Nat };
    #TooOld;
    #CreatedInFuture : { ledger_time : Nat64 };
    #Duplicate : { duplicate_of : Nat };
    #TemporarilyUnavailable;
    #GenericError : { error_code : Nat; message : Text };
  };

  type ICRC1Ledger = actor {
    icrc1_balance_of : (Account) -> async Nat;
    icrc1_transfer : (ICRC1TransferArgs) -> async { #Ok : Nat; #Err : ICRC1TransferError };
  };

  // KongSwap router: 2ipq2-uqaaa-aaaar-qailq-cai
  type KongSwapArgs = {
    pay_token : Text;
    pay_amount : Nat;
    pay_tx_id : ?{ #BlockIndex : Nat };
    receive_token : Text;
    receive_amount : ?Nat;
    receive_address : ?Text;
    max_slippage : ?Float;
    referred_by : ?Text;
    bypass_amount_check : ?Bool;
  };

  type KongSwapActor = actor {
    swap_async : (KongSwapArgs) -> async { #Ok : Nat; #Err : Text };
  };

  // ICPSwap per-pair pool canister
  type ICPSwapPoolArgs = {
    zeroForOne : Bool;
    amountIn : Text;
    amountOutMinimum : Text;
  };

  type ICPSwapPool = actor {
    depositFrom : (token : Principal, amount : Nat, fee : Nat) -> async { #ok : Nat; #err : Text };
    swap : (ICPSwapPoolArgs) -> async { #ok : Int; #err : Text };
    withdraw : (token : Principal, fee : Nat, amount : Nat) -> async { #ok : Nat; #err : Text };
  };

  // ─── ckBTC Minter Interface ─────────────────────────────────────────────────
  // Official ckBTC minter: mqygn-kiaaa-aaaar-qaadq-cai
  type CkBtcMinterActor = actor {
    get_btc_address : (arg : { owner : ?Principal; subaccount : ?Blob }) -> async Text;
    update_balance : (arg : { owner : ?Principal; subaccount : ?Blob }) -> async { #Ok : { block_index : Nat; amount : Nat }; #Err : Text };
  };

  // ─── ckETH Minter Interface ─────────────────────────────────────────────────
  // Official ckETH minter: sv3dd-oaaaa-aaaar-qacoa-cai
  type CkEthMinterActor = actor {
    get_eth_address : () -> async { #Ok : Text; #Err : Text };
    update_balance : () -> async { #Ok : { block_index : Nat; amount : Nat }; #Err : Text };
  };

  // ─── App Types ──────────────────────────────────────────────────────────────

  type UserProfile = {
    displayName : Text;
    preferredCurrency : Text;
    riskPreference : Text;
  };

  public type FundingEntryType = {
    #deposit;
    #stakingReward;
  };

  public type FundingEntry = {
    id : Nat;
    entryType : FundingEntryType;
    amountICP : Float;
    note : Text;
    timestamp : Int;
  };

  public type Holding = {
    tokenCanisterId : Text;
    symbol : Text;
    balance : Float;
    costBasis : Float;
  };

  type Basket = {
    id : Nat;
    name : Text;
    description : Text;
    slots : [BasketSlot];
    rebalanceThresholdBps : Nat;
    riskTier : Text;
    createdAt : Int;
    updatedAt : Int;
  };

  type BasketSlot = {
    pairTradeId : Nat;
    targetWeightBps : Nat;
    slotLabel : Text;
  };

  public type RiskTier = {
    #conservative;
    #moderate;
    #aggressive;
  };

  public type PairTrade = {
    id : Nat;
    tokenAAddress : Text;
    tokenASymbol : Text;
    tokenBAddress : Text;
    tokenBSymbol : Text;
    allocationUsd : Float;
    riskTier : RiskTier;
    routeViaICP : Bool;
    createdAt : Int;
    notes : Text;
  };

  public type SwapReceipt = {
    id : Text;
    timestamp : Int;
    tokenIn : Text;
    amountIn : Float;
    tokenOut : Text;
    amountOut : Float;
    route : Text;
    priceImpactPct : Float;
    realizedPnL : Float;
  };

  // ─── Portfolio Snapshot Type ────────────────────────────────────────────────
  public type PortfolioSnapshot = {
    timestamp : Int;
    totalValueUsd : Float;
  };

  // ─── Authorization ─────────────────────────────────────────────────────────
  let accessControlState = AccessControl.initState();
  include MixinAuthorization(accessControlState);

  // ─── State ─────────────────────────────────────────────────────────────────

  let userProfiles = Map.empty<Principal, UserProfile>();

  var ownerPrincipal : ?Principal = null;
  var displayName = "";
  var preferredCurrency = "USD";
  var riskPreference = "Moderate";

  var nextPairTradeId = 1;
  let pairTrades = Map.empty<Nat, PairTrade>();
  var nextBasketId = 1;
  let baskets = Map.empty<Nat, Basket>();
  let basketFocusAssets = Map.empty<Nat, Text>();

  var tradeCountThisMonth : Nat = 0;
  var tradeCountResetAt : Int = 0;

  var fundingEntries : [FundingEntry] = [];
  var nextFundingEntryId = 1;

  var holdings : [Holding] = [];

  var swapReceipts : [SwapReceipt] = [];
  var nextSwapReceiptId : Nat = 1;

  let approvedUntil = Map.empty<Principal, Int>();
  let decimalsRegistry = Map.empty<Principal, Nat8>();
  let agentEnabled = Map.empty<Nat, Bool>();

  // Dedicated subaccount index used for unique deposit address derivation
  let dedicatedSubaccount : Nat = 0;

  // Pre-populate known ICP ecosystem tokens
  decimalsRegistry.add(Principal.fromText("ryjl3-tyaaa-aaaaa-aaaba-cai"), (8 : Nat8));  // ICP
  decimalsRegistry.add(Principal.fromText("mxzaz-hqaaa-aaaar-qaada-cai"), (8 : Nat8));  // ckBTC
  decimalsRegistry.add(Principal.fromText("ss2fx-dyaaa-aaaar-qacoq-cai"), (18 : Nat8)); // ckETH
  decimalsRegistry.add(Principal.fromText("xevnm-gaaaa-aaaar-qafnq-cai"), (6 : Nat8));  // ckUSDC
  decimalsRegistry.add(Principal.fromText("cngnf-vqaaa-aaaar-qag4q-cai"), (6 : Nat8));  // ckUSDT

  // ─── Token Universe Cache ────────────────────────────────────────────────────
  var dexScreenerCache : Text = "";
  var icpSwapCache : Text = "";
  var kongSwapCache : Text = "";
  var tokenCacheUpdatedAt : Int = 0;

  // ─── Portfolio Snapshot State ───────────────────────────────────────────────
  var portfolioSnapshots : [PortfolioSnapshot] = [];
  var lastPortfolioValueUsd : Float = 0.0;

  // ─── Private Helpers ────────────────────────────────────────────────────────

  func getDecimalsInternal(token : Principal) : Nat8 {
    switch (decimalsRegistry.get(token)) {
      case (?d) { d };
      case (null) { 8 };
    };
  };

  func floatToNat(amount : Float, decimals : Nat8) : Nat {
    var mult : Float = 1.0;
    var i : Nat = 0;
    while (i < decimals.toNat()) { mult := mult * 10.0; i += 1 };
    let raw : Int = (amount * mult).toInt();
    if (raw <= 0) { 0 } else { Int.abs(raw) };
  };

  func natToFloat(amount : Nat, decimals : Nat8) : Float {
    var divisor : Float = 1.0;
    var i : Nat = 0;
    while (i < decimals.toNat()) { divisor := divisor * 10.0; i += 1 };
    var result : Float = 0.0;
    var n = amount;
    var pos : Float = 1.0;
    while (n > 0) {
      let digit = n % 10; result := result + digit.toInt().toFloat() * pos;
      pos := pos * 10.0;
      n := n / 10;
    };
    result / divisor;
  };

  func recordSnapshotInternal() : () {
    let snapshot : PortfolioSnapshot = {
      timestamp = Time.now();
      totalValueUsd = lastPortfolioValueUsd;
    };
    var updated = portfolioSnapshots.concat([snapshot]);
    if (updated.size() > 1000) {
      let startIdx = updated.size() - 1000 : Nat;
      updated := Array.tabulate(1000, func(i : Nat) : PortfolioSnapshot { updated[startIdx + i] });
    };
    portfolioSnapshots := updated;
  };

  // ─── 5-Minute Snapshot Timer ────────────────────────────────────────────────
  let fiveMinutesNs : Nat64 = 5 * 60 * 1_000_000_000;

  system func timer(setGlobalTimer : Nat64 -> ()) : async () {
    let nowNs : Int = Time.now();
    let nowNat : Nat = if (nowNs > 0) { Int.abs(nowNs) } else { 0 };
    let nextFire = Nat64.fromNat(nowNat) + fiveMinutesNs;
    setGlobalTimer(nextFire);
    recordSnapshotInternal();
    runAgentCheckInternal();
  };

  // ─── User Profile Methods ────────────────────────────────────────────────────

  public query ({ caller }) func getCallerUserProfile() : async ?UserProfile {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view profiles");
    };
    userProfiles.get(caller);
  };

  public query ({ caller }) func getUserProfile(user : Principal) : async ?UserProfile {
    if (caller != user and not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Can only view your own profile");
    };
    userProfiles.get(user);
  };

  public shared ({ caller }) func saveCallerUserProfile(profile : UserProfile) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can save profiles");
    };
    userProfiles.add(caller, profile);
  };

  public shared ({ caller }) func setProfile(name : Text, currency : Text, risk : Text) : async {
    #ok;
    #err : Text;
  } {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      return #err("Unauthorized: Only users can set profiles");
    };
    switch (ownerPrincipal) {
      case (null) { ownerPrincipal := ?caller };
      case (?owner) {
        if (caller != owner) {
          return #err("Unauthorized: this platform is single-user only.");
        };
      };
    };
    displayName := name;
    preferredCurrency := currency;
    riskPreference := risk;
    #ok;
  };

  public query ({ caller }) func getProfile() : async {
    #ok : {
      displayName : Text;
      preferredCurrency : Text;
      riskPreference : Text;
      ownerPrincipal : ?Principal;
    };
    #err : Text;
  } {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      return #err("Unauthorized: Only users can view profiles");
    };
    switch (ownerPrincipal) {
      case (null) { #ok({ displayName; preferredCurrency; riskPreference; ownerPrincipal }) };
      case (?owner) {
        if (caller != owner) {
          return #err("Unauthorized: this platform is single-user only.");
        };
        #ok({ displayName; preferredCurrency; riskPreference; ownerPrincipal });
      };
    };
  };

  public query ({ caller }) func isOwner() : async Bool {
    switch (ownerPrincipal) {
      case (null) { false };
      case (?owner) { caller == owner };
    };
  };

  public query ({ caller }) func getTradeFrequencyStatus() : async {
    usedThisMonth : Nat;
    limitThisMonth : Nat;
    resetsAt : Int;
    pctUsed : Nat;
  } {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view trade frequency status");
    };
    let limit : Nat = switch (riskPreference) {
      case ("Conservative") { 30 };
      case ("Aggressive") { 300 };
      case (_) { 100 };
    };
    let pct : Nat = if (limit == 0) { 0 } else { tradeCountThisMonth * 100 / limit };
    let resetTs : Int = if (tradeCountResetAt == 0) {
      Time.now() + 30 * 24 * 60 * 60 * 1_000_000_000
    } else {
      tradeCountResetAt
    };
    { usedThisMonth = tradeCountThisMonth; limitThisMonth = limit; resetsAt = resetTs; pctUsed = pct };
  };

  // ─── HTTP Outcalls ───────────────────────────────────────────────────────────

  public query ({ caller = _ }) func transform(input : OutCall.TransformationInput) : async OutCall.TransformationOutput {
    OutCall.transform(input);
  };

  public shared ({ caller }) func fetchDexScreenerPairs() : async Text {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can fetch DexScreener pairs");
    };
    let result = try { await OutCall.httpGetRequest("https://api.dexscreener.com/latest/dex/pairs/icp", [], transform) } catch (_) { "[]" };
    if (result.size() > 2) { dexScreenerCache := result };
    result;
  };

  public shared ({ caller }) func fetchICPSwapTokens() : async Text {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can fetch ICPSwap tokens");
    };
    let result = try { await OutCall.httpGetRequest("https://api.icpswap.com/v3/token/list", [], transform) } catch (_) { "{}" };
    if (result.size() > 2) { icpSwapCache := result };
    result;
  };

  public shared ({ caller }) func fetchKongSwapTokens() : async Text {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can fetch KongSwap tokens");
    };
    let result = try { await OutCall.httpGetRequest("https://api.kongswap.io/api/tokens", [], transform) } catch (_) { "{}" };
    if (result.size() > 2) { kongSwapCache := result };
    result;
  };

  public query ({ caller }) func getTokenUniverseCaches() : async { dexScreener : Text; icpSwap : Text; kongSwap : Text; updatedAt : Int } {
    ignore caller;
    { dexScreener = dexScreenerCache; icpSwap = icpSwapCache; kongSwap = kongSwapCache; updatedAt = tokenCacheUpdatedAt };
  };

  public shared ({ caller }) func updateTokenUniverse() : async () {
    ignore caller;
    let ds = try { await OutCall.httpGetRequest("https://api.dexscreener.com/latest/dex/pairs/icp", [], transform) } catch (_) { "" };
    if (ds.size() > 2) { dexScreenerCache := ds };

    let ics = try { await OutCall.httpGetRequest("https://api.icpswap.com/v3/token/list", [], transform) } catch (_) { "" };
    if (ics.size() > 2) { icpSwapCache := ics };

    let ks = try { await OutCall.httpGetRequest("https://api.kongswap.io/api/tokens", [], transform) } catch (_) { "" };
    if (ks.size() > 2) { kongSwapCache := ks };

    tokenCacheUpdatedAt := Time.now();
  };

  public query func getHardcodedTokens() : async Text {
    "{\"tokens\":[" #
    "{\"canisterId\":\"ryjl3-tyaaa-aaaaa-aaaba-cai\",\"symbol\":\"ICP\",\"name\":\"Internet Computer\",\"decimals\":8,\"priceUsd\":0}," #
    "{\"canisterId\":\"mxzaz-hqaaa-aaaar-qaada-cai\",\"symbol\":\"ckBTC\",\"name\":\"Chain-Key Bitcoin\",\"decimals\":8,\"priceUsd\":0}," #
    "{\"canisterId\":\"ss2fx-dyaaa-aaaar-qacoq-cai\",\"symbol\":\"ckETH\",\"name\":\"Chain-Key Ethereum\",\"decimals\":18,\"priceUsd\":0}," #
    "{\"canisterId\":\"xevnm-gaaaa-aaaar-qafnq-cai\",\"symbol\":\"ckUSDC\",\"name\":\"Chain-Key USDC\",\"decimals\":6,\"priceUsd\":1}," #
    "{\"canisterId\":\"cngnf-vqaaa-aaaar-qag4q-cai\",\"symbol\":\"ckUSDT\",\"name\":\"Chain-Key USDT\",\"decimals\":6,\"priceUsd\":1}" #
    "]}"
  };

  // ─── Pair Trades ───────────────────────────────────────────────────────────────

  public shared ({ caller }) func createPairTrade(
    tokenAAddress : Text, tokenASymbol : Text,
    tokenBAddress : Text, tokenBSymbol : Text,
    allocationUsd : Float, riskTier : RiskTier,
    routeViaICP : Bool, notes : Text,
  ) : async Nat {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can create pair trades");
    };
    let newTrade : PairTrade = {
      id = nextPairTradeId; tokenAAddress; tokenASymbol; tokenBAddress; tokenBSymbol;
      allocationUsd; riskTier; routeViaICP; createdAt = Time.now(); notes;
    };
    pairTrades.add(nextPairTradeId, newTrade);
    nextPairTradeId += 1;
    newTrade.id;
  };

  public query ({ caller }) func getPairTrades() : async [PairTrade] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view pair trades");
    };
    pairTrades.values().toArray();
  };

  public query ({ caller }) func getPairTrade(id : Nat) : async ?PairTrade {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view pair trades");
    };
    pairTrades.get(id);
  };

  public shared ({ caller }) func updatePairTrade(id : Nat, allocationUsd : Float, riskTier : RiskTier, notes : Text) : async Bool {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can update pair trades");
    };
    switch (pairTrades.get(id)) {
      case (null) { false };
      case (?trade) {
        pairTrades.add(id, { trade with allocationUsd; riskTier; notes });
        true;
      };
    };
  };

  public shared ({ caller }) func deletePairTrade(id : Nat) : async Bool {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can delete pair trades");
    };
    switch (pairTrades.get(id)) {
      case (null) { false };
      case (?_) { pairTrades.remove(id); true };
    };
  };

  public query ({ caller }) func getTradeFrequencyCap(riskTier : RiskTier) : async Nat {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view trade frequency caps");
    };
    switch (riskTier) {
      case (#conservative) { 30 };
      case (#moderate) { 100 };
      case (#aggressive) { 300 };
    };
  };

  // ─── Baskets ───────────────────────────────────────────────────────────────────

  public shared ({ caller }) func createBasket(
    name : Text, description : Text, slots : [BasketSlot], rebalanceThresholdBps : Nat, focusAsset : Text,
  ) : async { #ok : Nat; #err : Text } {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      return #err("Unauthorized: Only users can create baskets");
    };
    switch (validateBasketSlotsInternal(slots)) {
      case (#err(err)) { return #err(err) };
      case (#ok(())) {};
    };
    if (rebalanceThresholdBps < 100 or rebalanceThresholdBps > 2000) {
      return #err("Rebalance threshold must be between 100 and 2000 basis points");
    };
    let riskTier = deriveRiskTier(slots);
    let newBasket : Basket = {
      id = nextBasketId; name; description; slots; rebalanceThresholdBps; riskTier;
      createdAt = Time.now(); updatedAt = Time.now();
    };
    baskets.add(nextBasketId, newBasket);
    basketFocusAssets.add(nextBasketId, focusAsset);
    nextBasketId += 1;
    #ok(newBasket.id);
  };

  public query ({ caller }) func getBaskets() : async [Basket] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view baskets");
    };
    baskets.values().toArray();
  };

  public query ({ caller }) func getBasket(id : Nat) : async ?Basket {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view baskets");
    };
    baskets.get(id);
  };

  public shared ({ caller }) func updateBasket(
    id : Nat, name : Text, description : Text, slots : [BasketSlot], rebalanceThresholdBps : Nat, focusAsset : Text,
  ) : async { #ok; #err : Text } {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      return #err("Unauthorized: Only users can update baskets");
    };
    switch (validateBasketSlotsInternal(slots)) {
      case (#err(err)) { return #err(err) };
      case (#ok(())) {};
    };
    if (rebalanceThresholdBps < 100 or rebalanceThresholdBps > 2000) {
      return #err("Rebalance threshold must be between 100 and 2000 basis points");
    };
    let riskTier = deriveRiskTier(slots);
    switch (baskets.get(id)) {
      case (null) { return #err("Basket not found") };
      case (?existing) {
        baskets.add(id, { existing with name; description; slots; rebalanceThresholdBps; riskTier; updatedAt = Time.now() });
        basketFocusAssets.add(id, focusAsset);
        #ok;
      };
    };
  };

  public shared ({ caller }) func deleteBasket(id : Nat) : async Bool {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can delete baskets");
    };
    switch (baskets.get(id)) {
      case (null) { false };
      case (?_) { baskets.remove(id); true };
    };
  };

  public query ({ caller }) func validateBasketSlots(slots : [BasketSlot]) : async { valid : Bool; error : ?Text } {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can validate basket slots");
    };
    if (slots.size() < 3) { return { valid = false; error = ?"At least 3 basket slots required" } };
    if (slots.size() > 10) { return { valid = false; error = ?"At most 10 basket slots allowed" } };
    let weightSum = slots.foldLeft(0, func(acc, slot) { acc + slot.targetWeightBps });
    if (weightSum != 10_000) {
      return { valid = false; error = ?"Target weights must sum to exactly 10,000 basis points" };
    };
    let seen = Map.empty<Nat, ()>();
    let hasDuplicate = slots.foldLeft(false, func(acc, slot) {
      switch (seen.get(slot.pairTradeId)) {
        case (?_) { true };
        case (null) { seen.add(slot.pairTradeId, ()); acc };
      };
    });
    if (hasDuplicate) { return { valid = false; error = ?"Duplicate pair trade references not allowed" } };
    let allExist = slots.foldLeft(true, func(acc, slot) {
      if (not acc) { false } else {
        switch (pairTrades.get(slot.pairTradeId)) { case (null) { false }; case (?_) { true } };
      };
    });
    if (not allExist) { return { valid = false; error = ?"One or more slots reference missing pair trades" } };
    { valid = true; error = null };
  };

  public shared ({ caller }) func getBasketRiskTier(id : Nat) : async ?Text {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view basket risk tiers");
    };
    switch (baskets.get(id)) {
      case (null) { null };
      case (?basket) { ?basket.riskTier };
    };
  };

  public query ({ caller }) func getBasketFocusAsset(id : Nat) : async Text {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view baskets");
    };
    switch (basketFocusAssets.get(id)) {
      case (null) { "" };
      case (?fa) { fa };
    };
  };

  func validateBasketSlotsInternal(slots : [BasketSlot]) : { #ok; #err : Text } {
    if (slots.size() < 3) { return #err("At least 3 basket slots required") };
    if (slots.size() > 10) { return #err("At most 10 basket slots allowed") };
    let weightSum = slots.foldLeft(0, func(acc, slot) { acc + slot.targetWeightBps });
    if (weightSum != 10_000) { return #err("Target weights must sum to exactly 10,000 basis points") };
    let seen = Map.empty<Nat, ()>();
    let hasDuplicate = slots.foldLeft(false, func(acc, slot) {
      switch (seen.get(slot.pairTradeId)) {
        case (?_) { true };
        case (null) { seen.add(slot.pairTradeId, ()); acc };
      };
    });
    if (hasDuplicate) { return #err("Duplicate pair trade references not allowed") };
    let allExist = slots.foldLeft(true, func(acc, slot) {
      if (not acc) { false } else {
        switch (pairTrades.get(slot.pairTradeId)) { case (null) { false }; case (?_) { true } };
      };
    });
    if (not allExist) { return #err("One or more slots reference missing pair trades") };
    #ok;
  };

  func deriveRiskTier(slots : [BasketSlot]) : Text {
    let hasAggressive = slots.foldLeft(false, func(acc, slot) {
      if (acc) { true } else {
        switch (pairTrades.get(slot.pairTradeId)) {
          case (?t) { switch (t.riskTier) { case (#aggressive) { true }; case (_) { false } } };
          case (null) { false };
        };
      };
    });
    if (hasAggressive) { return "Aggressive" };
    let hasModerate = slots.foldLeft(false, func(acc, slot) {
      if (acc) { true } else {
        switch (pairTrades.get(slot.pairTradeId)) {
          case (?t) { switch (t.riskTier) { case (#moderate) { true }; case (_) { false } } };
          case (null) { false };
        };
      };
    });
    if (hasModerate) { return "Moderate" };
    "Conservative";
  };

  // ─── Funding Ledger ────────────────────────────────────────────────────────────

  public shared ({ caller }) func addFundingEntry(entryType : FundingEntryType, amountICP : Float, note : Text) : async Nat {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can add funding entries");
    };
    let newEntry : FundingEntry = { id = nextFundingEntryId; entryType; amountICP; note; timestamp = Time.now() };
    fundingEntries := fundingEntries.concat([newEntry]);
    nextFundingEntryId += 1;
    newEntry.id;
  };

  public query ({ caller }) func getFundingEntries() : async [FundingEntry] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view funding entries");
    };
    fundingEntries;
  };

  public query ({ caller }) func getTotalFundedICP() : async Float {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view total funded ICP");
    };
    fundingEntries.foldLeft(0.0, func(acc, entry) { acc + entry.amountICP });
  };

  // ─── Holdings ──────────────────────────────────────────────────────────────────

  public query ({ caller }) func getHoldings() : async [Holding] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view holdings");
    };
    holdings;
  };

  public query ({ caller }) func getHolding(tokenCanisterId : Text) : async ?Holding {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view holdings");
    };
    holdings.find(func(h : Holding) : Bool { h.tokenCanisterId == tokenCanisterId });
  };

  public shared ({ caller }) func updateHolding(tokenCanisterId : Text, amountChange : Float) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can update holdings");
    };
    let existing = holdings.find(func(h : Holding) : Bool { h.tokenCanisterId == tokenCanisterId });
    switch (existing) {
      case (?_) {
        holdings := holdings.map(func(h : Holding) : Holding {
          if (h.tokenCanisterId == tokenCanisterId) { { h with balance = h.balance + amountChange } } else { h };
        });
      };
      case (null) {
        holdings := holdings.concat([{ tokenCanisterId; symbol = ""; balance = amountChange; costBasis = 0.0 }]);
      };
    };
  };

  // ─── Swap Execution — Real On-Chain ────────────────────────────────────────

  public shared ({ caller }) func getSwapQuote(_tokenIn : Text, amountIn : Float, _tokenOut : Text) : async Float {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can get swap quotes");
    };
    amountIn * 0.97;
  };

  public shared ({ caller }) func grantTradingPermission() : async Text {
    switch (ownerPrincipal) {
      case (null) { return "Error: No owner set. Call setProfile first." };
      case (?owner) {
        if (caller != owner) { return "Unauthorized: this platform is single-user only." };
      };
    };
    approvedUntil.add(caller, Time.now() + 24 * 60 * 60 * 1_000_000_000);
    "Trading permission granted for 24 hours. You may now execute real swaps.";
  };

  public shared ({ caller }) func revokeTradingPermission() : async Text {
    switch (ownerPrincipal) {
      case (null) { return "Error: No owner set." };
      case (?owner) {
        if (caller != owner) { return "Unauthorized: this platform is single-user only." };
      };
    };
    approvedUntil.remove(caller);
    "All trading permissions revoked.";
  };

  public query ({ caller }) func getTradingPermissionExpiry() : async ?Int {
    switch (ownerPrincipal) {
      case (null) { null };
      case (?owner) {
        if (caller != owner) { null } else { approvedUntil.get(caller) };
      };
    };
  };

  public query ({ caller }) func getDecimals(token : Principal) : async Nat8 {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized");
    };
    getDecimalsInternal(token);
  };

  public shared ({ caller }) func setDecimals(token : Principal, decimals : Nat8) : async () {
    switch (ownerPrincipal) {
      case (?owner) {
        if (caller != owner) { Runtime.trap("Unauthorized: Only the owner can set decimals.") };
      };
      case (null) { Runtime.trap("Unauthorized: No owner set.") };
    };
    decimalsRegistry.add(token, decimals);
  };

  public shared ({ caller }) func executeSwap(
    tokenIn : Principal,
    amountIn : Float,
    tokenOut : Principal,
    route : Text,
    priceImpactPct : Float,
  ) : async Text {

    switch (ownerPrincipal) {
      case (null) { return "Error: No owner set. Call setProfile first." };
      case (?owner) {
        if (caller != owner) { return "Unauthorized: this platform is single-user only." };
      };
    };

    let expiry : Int = switch (approvedUntil.get(caller)) {
      case (null) { 0 };
      case (?ts) { ts };
    };
    if (Time.now() >= expiry) {
      return "Error: Trading permission expired or not granted. Call grantTradingPermission() first.";
    };

    let inDecimals = getDecimalsInternal(tokenIn);
    let amountNat = floatToNat(amountIn, inDecimals);
    if (amountNat == 0) {
      return "Error: Amount is zero after decimal conversion. Increase amountIn.";
    };

    let myPrincipal = Principal.fromActor(self);
    let tokenInLedger = actor(tokenIn.toText()) : ICRC2Ledger;

    let transferResult = await tokenInLedger.icrc2_transfer_from({
      spender_subaccount = null;
      from = { owner = caller; subaccount = null };
      to = { owner = myPrincipal; subaccount = null };
      amount = amountNat;
      fee = null;
      memo = null;
      created_at_time = null;
    });

    switch (transferResult) {
      case (#Err(_)) {
        return "Error: icrc2_transfer_from failed. Ensure you approved canister " # myPrincipal.toText() # " on the " # tokenIn.toText() # " ledger.";
      };
      case (#Ok(_)) {};
    };

    var dexTxId = "";
    var amountOut : Float = amountIn * 0.99;

    if (route.startsWith(#text "KongSwap-")) {
      let kong = actor("2ipq2-uqaaa-aaaar-qailq-cai") : KongSwapActor;
      switch (await kong.swap_async({
        pay_token = tokenIn.toText();
        pay_amount = amountNat;
        pay_tx_id = null;
        receive_token = tokenOut.toText();
        receive_amount = null;
        receive_address = null;
        max_slippage = ?(priceImpactPct * 1.5);
        referred_by = null;
        bypass_amount_check = ?false;
      })) {
        case (#Err(e)) { return "Error: KongSwap rejected swap: " # e };
        case (#Ok(reqId)) {
          dexTxId := reqId.toText();
          amountOut := amountIn * 0.99;
        };
      };

    } else if (route.startsWith(#text "ICPSwap-")) {
      let parts = route.split(#char ':').toArray();
      if (parts.size() < 2) {
        return "Error: Invalid ICPSwap route. Expected 'ICPSwap-Direct:<pool-canister-id>'";
      };
      let poolIdText = parts[1];
      let zeroForOne : Bool = not (parts.size() >= 3 and parts[2] == "false");
      let pool = actor(poolIdText) : ICPSwapPool;

      switch (await pool.depositFrom(tokenIn, amountNat, 0)) {
        case (#err(e)) { return "Error: ICPSwap depositFrom failed: " # e };
        case (#ok(_)) {};
      };

      switch (await pool.swap({ zeroForOne; amountIn = amountNat.toText(); amountOutMinimum = "0" })) {
        case (#err(e)) { return "Error: ICPSwap swap failed: " # e };
        case (#ok(outInt)) {
          dexTxId := outInt.toText();
          let outNat : Nat = if (outInt <= 0) { 0 } else { Int.abs(outInt) };
          amountOut := natToFloat(outNat, getDecimalsInternal(tokenOut));
          let _ = await pool.withdraw(tokenOut, 0, outNat);
        };
      };

    } else {
      return "Error: Unrecognized route prefix. Use 'KongSwap-' or 'ICPSwap-'";
    };

    let tokenInText = tokenIn.toText();
    let tokenOutText = tokenOut.toText();

    var realizedPnL : Float = 0.0;

    let updatedHoldings = holdings.map(func(h : Holding) : Holding {
      if (h.tokenCanisterId == tokenInText) {
        if (h.costBasis > 0.0) {
          realizedPnL := amountOut - (amountIn * h.costBasis);
        };
        { h with balance = h.balance - amountIn };
      } else if (h.tokenCanisterId == tokenOutText) {
        let newBalance = h.balance + amountOut;
        let newCostBasis = if (newBalance == 0.0) { 0.0 } else {
          (h.balance * h.costBasis + amountIn) / newBalance;
        };
        { h with balance = newBalance; costBasis = newCostBasis };
      } else { h };
    });

    let hasTokenIn = holdings.any(func(h) { h.tokenCanisterId == tokenInText });
    let hasTokenOut = holdings.any(func(h) { h.tokenCanisterId == tokenOutText });

    holdings := updatedHoldings.concat(
      if (not hasTokenIn) { [{ tokenCanisterId = tokenInText; symbol = ""; balance = -amountIn; costBasis = 0.0 }] } else { [] }
    ).concat(
      if (not hasTokenOut) {
        [{ tokenCanisterId = tokenOutText; symbol = ""; balance = amountOut; costBasis = amountIn / amountOut }];
      } else { [] }
    );

    tradeCountThisMonth += 1;
    if (tradeCountResetAt == 0) {
      tradeCountResetAt := Time.now() + 30 * 24 * 60 * 60 * 1_000_000_000;
    };

    let execId = "EXEC-" # nextSwapReceiptId.toText() # "-" # dexTxId;
    swapReceipts := swapReceipts.concat([{
      id = execId; timestamp = Time.now();
      tokenIn = tokenInText; amountIn;
      tokenOut = tokenOutText; amountOut;
      route; priceImpactPct; realizedPnL;
    }]);
    nextSwapReceiptId += 1;

    recordSnapshotInternal();
    runAgentCheckInternal();

    execId;
  };

  public query ({ caller }) func getSwapReceipts() : async [SwapReceipt] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view swap receipts");
    };
    swapReceipts;
  };

  public query ({ caller }) func getAvailableICPBalance() : async Float {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view available ICP balance");
    };
    let totalFunded = fundingEntries.foldLeft(0.0, func(acc, e) { acc + e.amountICP });
    let icpSwapped = swapReceipts.foldLeft(0.0, func(acc, r) {
      if (r.tokenIn == "ryjl3-tyaaa-aaaaa-aaaba-cai" or r.tokenIn == "ICP") { acc + r.amountIn }
      else { acc };
    });
    totalFunded - icpSwapped;
  };

  public query ({ caller }) func getTotalRealizedPnL() : async Float {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view realized PnL");
    };
    swapReceipts.foldLeft(0.0, func(acc, r) { acc + r.realizedPnL });
  };

  public shared ({ caller }) func getPortfolioValue(priceMap : [(Text, Float)]) : async Float {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view portfolio value");
    };
    let value = holdings.foldLeft(0.0, func(acc, h) {
      switch (priceMap.find(func((id, _)) { id == h.tokenCanisterId })) {
        case (null) { acc };
        case (?(_, price)) { acc + h.balance * price };
      };
    });
    lastPortfolioValueUsd := value;
    value;
  };

  public shared ({ caller }) func getUnrealizedPnL(priceMap : [(Text, Float)], icpPriceUsd : Float) : async Float {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view unrealized PnL");
    };
    holdings.foldLeft(0.0, func(acc, h) {
      if (h.costBasis > 0.0) {
        switch (priceMap.find(func((id, _)) { id == h.tokenCanisterId })) {
          case (null) { acc };
          case (?(_, currentUsdPrice)) {
            let currentIcpPrice = currentUsdPrice / icpPriceUsd;
            acc + h.balance * (currentIcpPrice - h.costBasis);
          };
        };
      } else { acc };
    });
  };

  // ─── Portfolio Snapshot Methods ─────────────────────────────────────────────

  public shared ({ caller }) func recordPortfolioSnapshot() : async Text {
    switch (ownerPrincipal) {
      case (null) { return "Error: No owner set." };
      case (?owner) {
        if (caller != owner) { return "Unauthorized: this platform is single-user only." };
      };
    };
    recordSnapshotInternal();
    runAgentCheckInternal();
    "Snapshot recorded. totalValueUsd = " # lastPortfolioValueUsd.toText() # ", total snapshots = " # portfolioSnapshots.size().toText();
  };

  public query ({ caller }) func getPortfolioHistory(days : Nat) : async [PortfolioSnapshot] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view portfolio history");
    };
    let cutoff : Int = if (days == 0) { 0 }
      else { Time.now() - days.toInt() * 24 * 60 * 60 * 1_000_000_000 };
    let filtered = portfolioSnapshots.filter(func(s : PortfolioSnapshot) : Bool {
      s.timestamp >= cutoff;
    });
    let size = filtered.size();
    Array.tabulate(size, func(i : Nat) : PortfolioSnapshot { filtered[size - 1 - i] });
  };

  public shared ({ caller }) func getBasketDrift(basketId : Nat, priceMap : [(Text, Float)]) : async [{ slotIndex : Nat; driftBps : Int; direction : Text }] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view basket drift");
    };
    switch (baskets.get(basketId)) {
      case (null) { [] };
      case (?basket) {
        var totalBasketValue : Float = 0.0;
        for (slot in basket.slots.vals()) {
          switch (pairTrades.get(slot.pairTradeId)) {
            case (null) {};
            case (?trade) {
              let holdingOpt = holdings.find(func(h : Holding) : Bool { h.tokenCanisterId == trade.tokenBAddress });
              switch (holdingOpt) {
                case (null) {};
                case (?holding) {
                  switch (priceMap.find(func((id, _)) { id == holding.tokenCanisterId })) {
                    case (null) {};
                    case (?(_, price)) { totalBasketValue += holding.balance * price };
                  };
                };
              };
            };
          };
        };

        Array.tabulate(
          basket.slots.size(),
          func(i : Nat) : { slotIndex : Nat; driftBps : Int; direction : Text } {
            let slot = basket.slots[i];
            var actualWeightBps : Int = 0;
            if (totalBasketValue > 0.0) {
              switch (pairTrades.get(slot.pairTradeId)) {
                case (null) {};
                case (?trade) {
                  let holdingOpt = holdings.find(func(h : Holding) : Bool { h.tokenCanisterId == trade.tokenBAddress });
                  switch (holdingOpt) {
                    case (null) {};
                    case (?holding) {
                      switch (priceMap.find(func((id, _)) { id == holding.tokenCanisterId })) {
                        case (null) {};
                        case (?(_, price)) {
                          let slotValue = holding.balance * price;
                          actualWeightBps := ((slotValue * 10_000.0) / totalBasketValue).toInt();
                        };
                      };
                    };
                  };
                };
              };
            };
            let drift = actualWeightBps - slot.targetWeightBps.toInt();
            let direction = if (drift > 0) { "over" } else if (drift < 0) { "under" } else { "on-target" };
            { slotIndex = i; driftBps = drift; direction };
          }
        );
      };
    };
  };

  // ─── Wallet: Deposit Address Methods ──────────────────────────────────────

  // Returns the canister's own principal as the ICP/ICRC-1 deposit address.
  // Subaccount 0 is used (dedicatedSubaccount).
  public query func getUniqueDepositAddress() : async Text {
    let canisterId = Principal.fromActor(self);
    canisterId.toText() # ":" # dedicatedSubaccount.toText();
  };

  // Returns the Bitcoin deposit address derived by the official ckBTC minter
  // for this canister's principal + subaccount 0.
  // ckBTC minter canister: mqygn-kiaaa-aaaar-qaadq-cai
  public shared func getBtcDepositAddress() : async Text {
    let minter = actor("mqygn-kiaaa-aaaar-qaadq-cai") : CkBtcMinterActor;
    try {
      await minter.get_btc_address({
        owner = ?Principal.fromActor(self);
        subaccount = null;
      });
    } catch (e) {
      "Error: Could not retrieve BTC deposit address. " # e.message();
    };
  };

  // Returns the Ethereum deposit address derived by the official ckETH minter
  // for this canister's principal.
  // ckETH minter canister: sv3dd-oaaaa-aaaar-qacoa-cai
  public shared func getEthDepositAddress() : async Text {
    let minter = actor("sv3dd-oaaaa-aaaar-qacoa-cai") : CkEthMinterActor;
    try {
      switch (await minter.get_eth_address()) {
        case (#Ok(addr)) { addr };
        case (#Err(e)) { "Error: " # e };
      };
    } catch (e) {
      "Error: Could not retrieve ETH deposit address. " # e.message();
    };
  };

  // ─── Wallet: Get canister own Principal (deposit address) ──────────────────
  public query func getCanisterId() : async Principal {
    Principal.fromActor(self)
  };

  // ─── Wallet: Sync on-chain balances for all held tokens ────────────────────
  public shared ({ caller }) func syncBalances() : async Text {
    switch (ownerPrincipal) {
      case (null) { return "Error: No owner set." };
      case (?owner) {
        if (caller != owner) { return "Unauthorized: this platform is single-user only." };
      };
    };
    var updatedCount = 0;
    var newHoldings : [Holding] = holdings;
    for (holding in holdings.vals()) {
      try {
        let ledger : ICRC1Ledger = actor(holding.tokenCanisterId);
        let balance = await ledger.icrc1_balance_of({
          owner = Principal.fromActor(self);
          subaccount = null;
        });
        let decimalsVal : Nat8 = switch (decimalsRegistry.get(Principal.fromText(holding.tokenCanisterId))) {
          case (?d) { d };
          case (null) { 8 };
        };
        let floatBalance = natToFloat(balance, decimalsVal);
        newHoldings := newHoldings.map(func(h : Holding) : Holding {
          if (h.tokenCanisterId == holding.tokenCanisterId) {
            { h with balance = floatBalance }
          } else { h };
        });
        updatedCount += 1;
      } catch (_) {};
    };
    holdings := newHoldings;
    "Synced " # updatedCount.toText() # " token balance(s).";
  };

  // ─── Wallet: Withdraw tokens from canister to destination ──────────────────
  public shared ({ caller }) func withdraw(
    tokenCanisterId : Principal,
    amount : Float,
    destination : ?Principal
  ) : async Text {
    switch (ownerPrincipal) {
      case (null) { return "Error: No owner set." };
      case (?owner) {
        if (caller != owner) { return "Unauthorized: this platform is single-user only." };
      };
    };
    let dest : Principal = switch (destination) {
      case (?d) { d };
      case (null) {
        switch (ownerPrincipal) {
          case (?owner) { owner };
          case (null) { return "Error: No destination principal provided." };
        };
      };
    };
    let decimalsVal : Nat8 = switch (decimalsRegistry.get(tokenCanisterId)) {
      case (?d) { d };
      case (null) { 8 };
    };
    let amountNat : Nat = floatToNat(amount, decimalsVal);
    let ledger : ICRC1Ledger = actor(tokenCanisterId.toText());
    let result = await ledger.icrc1_transfer({
      to = { owner = dest; subaccount = null };
      amount = amountNat;
      fee = null;
      memo = null;
      from_subaccount = null;
      created_at_time = null;
    });
    switch (result) {
      case (#Ok(blockIndex)) {
        holdings := holdings.map(func(h : Holding) : Holding {
          if (h.tokenCanisterId == tokenCanisterId.toText()) {
            let newBal = if (h.balance >= amount) { h.balance - amount } else { 0.0 };
            { h with balance = newBal }
          } else { h };
        });
        "Withdraw successful. Block index: " # blockIndex.toText();
      };
      case (#Err(e)) {
        "Error: withdraw failed. " # debug_show(e);
      };
    };
  };


  // ─── Smart Wallet: Trigger ckBTC minter balance update ─────────────────────
  // Tells the ckBTC minter to scan for incoming BTC and mint ckBTC to this canister.
  // Call this after sending BTC to the address returned by getBtcDepositAddress().
  // ckBTC minter: mqygn-kiaaa-aaaar-qaadq-cai
  public shared ({ caller }) func depositBtc() : async Text {
    switch (ownerPrincipal) {
      case (null) { return "Error: No owner set." };
      case (?owner) {
        if (caller != owner) { return "Unauthorized: this platform is single-user only." };
      };
    };
    let minter = actor("mqygn-kiaaa-aaaar-qaadq-cai") : CkBtcMinterActor;
    try {
      let result = await minter.update_balance({
        owner = ?Principal.fromActor(self);
        subaccount = null;
      });
      switch (result) {
        case (#Ok(r)) {
          "ckBTC deposit processed. Block index: " # r.block_index.toText() # ", Amount: " # r.amount.toText();
        };
        case (#Err(e)) {
          "ckBTC minter error: " # e;
        };
      };
    } catch (e) {
      "Error calling ckBTC minter: " # e.message();
    };
  };

  // ─── Smart Wallet: Trigger ckETH minter balance update ─────────────────────
  // Tells the ckETH minter to scan for incoming ETH and mint ckETH to this canister.
  // Call this after sending ETH to the address returned by getEthDepositAddress().
  // ckETH minter: sv3dd-oaaaa-aaaar-qacoa-cai
  public shared ({ caller }) func depositEth() : async Text {
    switch (ownerPrincipal) {
      case (null) { return "Error: No owner set." };
      case (?owner) {
        if (caller != owner) { return "Unauthorized: this platform is single-user only." };
      };
    };
    let minter = actor("sv3dd-oaaaa-aaaar-qacoa-cai") : CkEthMinterActor;
    try {
      let result = await minter.update_balance();
      switch (result) {
        case (#Ok(r)) {
          "ckETH deposit processed. Block index: " # r.block_index.toText() # ", Amount: " # r.amount.toText();
        };
        case (#Err(e)) {
          "ckETH minter error: " # e;
        };
      };
    } catch (e) {
      "Error calling ckETH minter: " # e.message();
    };
  };

  // Stub — frontend handles the real Internet Identity re-authentication flow
  public shared func requireIIVerification() : async Bool {
    return true;
  };

  // Withdraw with optional denomination conversion.
  // outputToken: "ICP" | "ckBTC" | "ckETH" | "Individual"
  // "Individual" means withdraw sourceToken as-is (no conversion).
  // For ICP/ckBTC/ckETH, if sourceToken != targetToken, performs a KongSwap-Direct swap
  // first (requires active 24h trading permission) then transfers the result to destination.
  public shared ({ caller }) func withdrawWithDenomination(
    sourceToken : Principal,
    amount : Float,
    outputToken : Text,
    destination : Principal,
  ) : async Text {

    let owner = switch (ownerPrincipal) {
      case (null) { return "Error: Owner not set." };
      case (?o) { o };
    };
    if (caller != owner) {
      return "Unauthorized: this platform is single-user only.";
    };

    let icpPrincipal   = Principal.fromText("ryjl3-tyaaa-aaaaa-aaaba-cai");
    let ckBtcPrincipal = Principal.fromText("mxzaz-hqaaa-aaaar-qaada-cai");
    let ckEthPrincipal = Principal.fromText("ss2fx-dyaaa-aaaar-qacoq-cai");

    let targetToken : Principal = switch (outputToken) {
      case "ICP"   { icpPrincipal  };
      case "ckBTC" { ckBtcPrincipal };
      case "ckETH" { ckEthPrincipal };
      case _       { sourceToken   };
    };

    let needsConversion = sourceToken != targetToken;
    let myPrincipal = Principal.fromActor(self);

    var withdrawToken = targetToken;
    var withdrawAmount = amount;

    if (needsConversion) {
      let expiry : Int = switch (approvedUntil.get(owner)) {
        case (null) { 0 };
        case (?ts)  { ts };
      };
      if (Time.now() >= expiry) {
        return "Error: Trading permission expired or not granted. Call grantTradingPermission() first.";
      };

      let srcDecimals = getDecimalsInternal(sourceToken);
      let amountNat   = floatToNat(amount, srcDecimals);
      if (amountNat == 0) {
        return "Error: Amount is zero after decimal conversion.";
      };

      let srcLedger = actor(sourceToken.toText()) : ICRC2Ledger;
      let pullResult = await srcLedger.icrc2_transfer_from({
        spender_subaccount = null;
        from = { owner = owner; subaccount = null };
        to   = { owner = myPrincipal; subaccount = null };
        amount = amountNat;
        fee  = null;
        memo = null;
        created_at_time = null;
      });

      switch (pullResult) {
        case (#Err(_)) {
          return "Error: icrc2_transfer_from failed. Ensure you approved canister " #
                 myPrincipal.toText() # " on the " # sourceToken.toText() # " ledger.";
        };
        case (#Ok(_)) {};
      };

      let kong = actor("2ipq2-uqaaa-aaaar-qailq-cai") : KongSwapActor;
      switch (await kong.swap_async({
        pay_token       = sourceToken.toText();
        pay_amount      = amountNat;
        pay_tx_id       = null;
        receive_token   = targetToken.toText();
        receive_amount  = null;
        receive_address = null;
        max_slippage    = ?1.5;
        referred_by     = null;
        bypass_amount_check = ?false;
      })) {
        case (#Err(e)) {
          return "Error: KongSwap conversion failed: " # e;
        };
        case (#Ok(_)) {
          withdrawAmount := amount * 0.99;
        };
      };
    };

    let dstDecimals = getDecimalsInternal(withdrawToken);
    let outNat      = floatToNat(withdrawAmount, dstDecimals);
    if (outNat == 0) {
      return "Error: Withdraw amount is zero after decimal conversion.";
    };

    let dstLedger = actor(withdrawToken.toText()) : ICRC1Ledger;
    let xferResult = await dstLedger.icrc1_transfer({
      to   = { owner = destination; subaccount = null };
      amount = outNat;
      fee  = null;
      memo = null;
      from_subaccount = null;
      created_at_time = null;
    });

    switch (xferResult) {
      case (#Ok(blockIndex)) {
        let tokenText = withdrawToken.toText();
        holdings := holdings.map(func(h : Holding) : Holding {
          if (h.tokenCanisterId == tokenText) {
            { h with balance = Float.max(0.0, h.balance - withdrawAmount) }
          } else { h }
        });
        "Withdrawal successful. Token: " # outputToken #
          ", Amount: " # withdrawAmount.toText() #
          ", Block: " # blockIndex.toText() #
          ", Destination: " # destination.toText();
      };
      case (#Err(e)) {
        "Error: icrc1_transfer failed: " # debug_show(e);
      };
    };
  };


  // ─── Agent Toggle ────────────────────────────────────────────────────────────
  public shared ({ caller }) func toggleAgent(id : Nat, _isPairTrade : Bool, enabled : Bool) : async Bool {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: this platform is single-user only");
    };
    agentEnabled.add(id, enabled);
    enabled
  };

  func analyzeAndDecide(id: Nat, isPairTrade: Bool, focusAssetPrice: Float, indicatorSummary: Text) : Text {
    let kind = if (isPairTrade) "PairTrade" else "Basket";
    Debug.print("Analyzing indicators for ID " # id.toText() # " (" # kind # ")...");
    Debug.print("Indicators: " # indicatorSummary);
    Debug.print("Focus price: $" # focusAssetPrice.toText());

    // Parse RSI from summary (e.g. "RSI=42.3, MACD=bearish, ...")
    var rsiVal : Float = 50.0;
    var macdBullish : Bool = false;
    var macdBearish : Bool = false;

    // Helper: parse float from digit chars using dot notation
    func parseFloat(s: Text) : Float {
      var result : Float = 0.0;
      var decimal : Bool = false;
      var decimalPlace : Float = 0.1;
      for (c in s.chars()) {
        if (c == '.') { decimal := true }
        else if (c >= '0' and c <= '9') {
          let digit : Float = (c.toNat32().toNat() - 48 : Nat).toFloat();
          if (decimal) {
            result += digit * decimalPlace;
            decimalPlace *= 0.1;
          } else {
            result := result * 10.0 + digit;
          };
        };
      };
      result
    };

    for (part in indicatorSummary.split(#char ',')) {
      let trimmed = part.trim(#char ' ');
      if (trimmed.startsWith(#text "RSI=")) {
        // Extract value after "RSI=" by splitting on "="
        var skipFirst = true;
        for (ep in trimmed.split(#char '=')) {
          if (skipFirst) { skipFirst := false }
          else { rsiVal := parseFloat(ep) };
        };
      };
      if (trimmed.contains(#text "MACD=bullish") or trimmed.contains(#text "MACD=up")) {
        macdBullish := true;
      };
      if (trimmed.contains(#text "MACD=bearish") or trimmed.contains(#text "MACD=down")) {
        macdBearish := true;
      };
    };

    let focusLabel = if (not isPairTrade) {
      switch (basketFocusAssets.get(id)) {
        case (?canisterId) { if (canisterId == "") "focusAsset" else canisterId };
        case null { "focusAsset" };
      }
    } else { "focusAsset" };

    let decision = if (rsiVal < 35.0 and macdBullish) {
      "BUY " # focusLabel
    } else if (rsiVal > 65.0 and macdBearish) {
      "SELL " # focusLabel
    } else {
      "HOLD"
    };

    Debug.print("Decision: " # decision # " | RSI=" # rsiVal.toText() # " | Focus price: $" # focusAssetPrice.toText());
    "Decision: " # decision # " | Focus price: $" # focusAssetPrice.toText()
  };

  func runAgentCheckInternal() : () {
    for ((id, isEnabled) in agentEnabled.entries()) {
      if (isEnabled) {
        let decision = analyzeAndDecide(id, true, 0.0, "no summary provided");
        Debug.print("Agent check for ID " # id.toText() # " => " # decision);
      };
    };
  };

};

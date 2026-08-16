import { DynamoDBClient, GetItemCommand, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';

const TABLE_NAME = process.env.PLATFORM_CACHE_TABLE || 'advitiyans-platform-cache';
const REGION = process.env.AWS_REGION || 'ap-south-1';

// TTL in seconds per platform
const TTL: Record<string, number> = {
  leetcode:   2 * 60 * 60, // 2 hours
  github:     1 * 60 * 60, // 1 hour
  gfg:        2 * 60 * 60, // 2 hours
  codeforces: 3 * 60 * 60, // 3 hours
  codechef:   3 * 60 * 60, // 3 hours
  default:    2 * 60 * 60, // 2 hours
};

let dynamo: DynamoDBClient | null = null;

function getClient(): DynamoDBClient {
  if (!dynamo) {
    dynamo = new DynamoDBClient({ region: REGION });
  }
  return dynamo;
}

/**
 * Fetch a cached platform API response.
 * Returns null if not found or expired.
 */
export async function getCached(platform: string, handle: string): Promise<any | null> {
  try {
    const key = `${platform}:${handle.toLowerCase()}`;
    const client = getClient();
    const result = await client.send(new GetItemCommand({
      TableName: TABLE_NAME,
      Key: marshall({ cacheKey: key }),
    }));

    if (!result.Item) return null;
    const item = unmarshall(result.Item);

    // Manual TTL check (DynamoDB TTL deletion can lag up to 48hrs)
    if (item.expiresAt && Date.now() / 1000 > item.expiresAt) return null;

    return item.data ?? null;
  } catch (err) {
    console.warn('[Cache] GET error:', err);
    return null;
  }
}

/**
 * Store a platform API response in cache.
 */
export async function setCached(platform: string, handle: string, data: any): Promise<void> {
  try {
    const key = `${platform}:${handle.toLowerCase()}`;
    const ttlSec = TTL[platform.toLowerCase()] ?? TTL.default;
    const expiresAt = Math.floor(Date.now() / 1000) + ttlSec;

    await getClient().send(new PutItemCommand({
      TableName: TABLE_NAME,
      Item: marshall({
        cacheKey: key,
        platform,
        handle: handle.toLowerCase(),
        data,
        expiresAt,
        cachedAt: new Date().toISOString(),
      }, { removeUndefinedValues: true }),
    }));
  } catch (err) {
    console.warn('[Cache] SET error:', err);
  }
}

/**
 * Main cache wrapper: cache-first, live-on-miss, store result.
 * Cache write is fire-and-forget (non-blocking).
 */
export async function cachedFetch(
  platform: string,
  handle: string,
  fetchFn: () => Promise<any>
): Promise<{ data: any; fromCache: boolean }> {
  const cached = await getCached(platform, handle);
  if (cached !== null) {
    return { data: cached, fromCache: true };
  }

  const data = await fetchFn();
  setCached(platform, handle, data).catch(() => {});
  return { data, fromCache: false };
}

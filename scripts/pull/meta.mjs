#!/usr/bin/env node
// Pull your own Meta data through the Graph API — the door Meta built for
// this — with an access token pasted here. Never a password: Meta locks an
// account that a script signs in to, and its terms forbid it.
//
// The token comes from developers.facebook.com → Tools → Graph API Explorer
// (README.md walks through it). It is typed unseen at the prompt, or taken
// from META_ACCESS_TOKEN when another program drives this script. Nothing
// pulled is written with a token inside it; the page tokens Meta returns are
// used for the page's own edges and dropped.
//
//   node scripts/pull/meta.mjs                        # every part the token allows
//   node scripts/pull/meta.mjs --what=pages,leads     # only these parts
//   node scripts/pull/meta.mjs --path=/me/accounts --fields=id,name
//
//   --what      me, pages, instagram, leads, whatsapp, ads — or all (default)
//   --path      any Graph API path instead of the presets, with --fields and --limit
//   --pages=<n> how many pages of results to follow per list (default 10, 100 items each)
//   --version   Graph API version (default v23.0)
//   --out=<dir> where to write (default test-results/pull/meta/<run>/)
import { ask } from '../medicine/lib/prompt.mjs';
import { outputDir, parseArgs, sleep, writeJson } from './lib/common.mjs';

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  console.log(`usage: node scripts/pull/meta.mjs [--what=me,pages,instagram,leads,whatsapp,ads] [--pages=<n>] [--version=vNN.0] [--out=<dir>]
       node scripts/pull/meta.mjs --path=/me/accounts [--fields=a,b,c] [--limit=100]

The access token is asked for at the prompt (not shown), or read from META_ACCESS_TOKEN.
Output: test-results/pull/meta/<run>/ — your own data, git-ignored, delete when done.`);
  process.exit(0);
}

const version = String(args.version ?? 'v23.0');
const GRAPH = `https://graph.facebook.com/${version}`;
const maxPages = Math.max(1, Number(args.pages ?? 10));

class GraphError extends Error {
  constructor(error) {
    super(error.message ?? 'unknown Graph API error');
    this.code = error.code;
    this.subcode = error.error_subcode;
    this.type = error.type;
  }
}

async function graphGet(url, token, attempt = 0) {
  const target = new URL(url);
  target.searchParams.set('access_token', token);
  const response = await fetch(target);
  const body = await response
    .json()
    .catch(() => ({
      error: { message: `HTTP ${response.status} with no JSON body`, code: response.status },
    }));
  if (body.error) {
    // 4, 17, 32, 613: Meta's rate limits. A minute's pause and one more try, then give up.
    if ([4, 17, 32, 613].includes(body.error.code) && attempt < 1) {
      console.log('  rate limited by Meta — waiting a minute');
      await sleep(60_000);
      return graphGet(url, token, attempt + 1);
    }
    throw new GraphError(body.error);
  }
  return body;
}

/** One node, or the first page of an edge. */
function node(path, params, token) {
  const target = new URL(GRAPH + path);
  for (const [key, value] of Object.entries(params ?? {}))
    if (value != null) target.searchParams.set(key, String(value));
  return graphGet(target.toString(), token);
}

/** Every item of an edge, following `paging.next` up to --pages times. */
async function list(path, params, token) {
  const items = [];
  let body = await node(path, { limit: 100, ...params }, token);
  for (let page = 1; ; page++) {
    items.push(...(body.data ?? []));
    const next = body.paging?.next;
    if (!next) break;
    if (page >= maxPages) {
      console.log(`  (stopped ${path} after ${page} pages — raise --pages to read on)`);
      break;
    }
    body = await graphGet(next, token);
  }
  return items;
}

function describe(error) {
  if (!(error instanceof GraphError)) return error.message;
  if (error.code === 190)
    return 'the token is invalid or has expired (a token from the Explorer lasts about an hour) — generate a new one';
  if (error.code === 10 || (error.code >= 200 && error.code <= 299))
    return `Meta says a permission is missing: ${error.message}`;
  return `${error.message} (code ${error.code}${error.subcode ? `/${error.subcode}` : ''})`;
}

/** An optional edge: say why it was skipped and carry on with an empty list. */
const skip = (label) => (error) => {
  console.log(`  ${label}: skipped — ${describe(error)}`);
  return [];
};

// What Meta returns for each part, and which permissions the token needs for it.
// A page's own edges (posts, forms, Instagram) are read with the page token
// that /me/accounts hands back — a user token alone is refused there.
const PRESETS = {
  me: {
    permissions: [],
    async run(token, write) {
      write('me.json', await node('/me', { fields: 'id,name,email' }, token));
    },
  },
  pages: {
    permissions: [
      'pages_show_list',
      'pages_read_engagement',
      'pages_read_user_content',
      'pages_messaging',
    ],
    async run(token, write) {
      const pages = await list(
        '/me/accounts',
        {
          fields:
            'id,name,category,link,fan_count,followers_count,about,phone,emails,website,instagram_business_account{id,username},access_token',
        },
        token,
      );
      write(
        'pages.json',
        pages.map(({ access_token: _dropped, ...page }) => page),
      );
      for (const page of pages) {
        const pageToken = page.access_token ?? token;
        const posts = await list(
          `/${page.id}/posts`,
          {
            fields:
              'id,created_time,message,permalink_url,full_picture,shares,likes.summary(true),comments.summary(true)',
          },
          pageToken,
        ).catch(skip(`${page.name} posts`));
        write(`pages/${page.id}-posts.json`, posts);
        const ratings = await list(
          `/${page.id}/ratings`,
          { fields: 'created_time,reviewer,rating,review_text,recommendation_type' },
          pageToken,
        ).catch(skip(`${page.name} ratings`));
        write(`pages/${page.id}-ratings.json`, ratings);
        const conversations = await list(
          `/${page.id}/conversations`,
          { fields: 'id,updated_time,participants,messages.limit(50){created_time,from,message}' },
          pageToken,
        ).catch(skip(`${page.name} inbox`));
        write(`pages/${page.id}-inbox.json`, conversations);
      }
    },
  },
  instagram: {
    permissions: ['pages_show_list', 'instagram_basic'],
    async run(token, write) {
      const pages = await list(
        '/me/accounts',
        { fields: 'id,name,instagram_business_account{id,username},access_token' },
        token,
      );
      const accounts = pages.filter((page) => page.instagram_business_account);
      if (!accounts.length) console.log('  no Instagram account is connected to any of your pages');
      for (const page of accounts) {
        const ig = page.instagram_business_account;
        const pageToken = page.access_token ?? token;
        const profile = await node(
          `/${ig.id}`,
          {
            fields:
              'id,username,name,biography,website,followers_count,follows_count,media_count,profile_picture_url',
          },
          pageToken,
        ).catch((error) => ({ id: ig.id, username: ig.username, error: describe(error) }));
        write(`instagram/${ig.id}-profile.json`, profile);
        const media = await list(
          `/${ig.id}/media`,
          {
            fields: 'id,caption,media_type,media_url,permalink,timestamp,like_count,comments_count',
          },
          pageToken,
        ).catch(skip(`${ig.username} media`));
        write(`instagram/${ig.id}-media.json`, media);
      }
    },
  },
  leads: {
    permissions: ['pages_show_list', 'pages_manage_ads', 'leads_retrieval'],
    async run(token, write) {
      const pages = await list('/me/accounts', { fields: 'id,name,access_token' }, token);
      for (const page of pages) {
        const pageToken = page.access_token ?? token;
        const forms = await list(
          `/${page.id}/leadgen_forms`,
          { fields: 'id,name,status,leads_count,created_time,questions' },
          pageToken,
        ).catch(skip(`${page.name} lead forms`));
        write(`leads/${page.id}-forms.json`, forms);
        for (const form of forms) {
          const leads = await list(
            `/${form.id}/leads`,
            { fields: 'id,created_time,ad_id,ad_name,campaign_name,platform,field_data' },
            pageToken,
          ).catch(skip(`form "${form.name}" leads`));
          write(`leads/${page.id}-${form.id}-leads.json`, leads);
        }
      }
    },
  },
  whatsapp: {
    permissions: ['business_management', 'whatsapp_business_management'],
    async run(token, write) {
      const businesses = await list('/me/businesses', { fields: 'id,name' }, token);
      write('whatsapp/businesses.json', businesses);
      if (!businesses.length)
        console.log(
          '  no business portfolio on this account — WhatsApp Business accounts live inside one',
        );
      for (const business of businesses) {
        const owned = await list(
          `/${business.id}/owned_whatsapp_business_accounts`,
          { fields: 'id,name,timezone_id,message_template_namespace,account_review_status' },
          token,
        ).catch(skip(`${business.name} WhatsApp accounts`));
        const shared = await list(
          `/${business.id}/client_whatsapp_business_accounts`,
          { fields: 'id,name,timezone_id,message_template_namespace,account_review_status' },
          token,
        ).catch(() => []);
        const accounts = [...owned, ...shared];
        write(`whatsapp/${business.id}-accounts.json`, accounts);
        for (const waba of accounts) {
          const numbers = await list(
            `/${waba.id}/phone_numbers`,
            {
              fields:
                'id,display_phone_number,verified_name,quality_rating,messaging_limit_tier,platform_type,code_verification_status',
            },
            token,
          ).catch(skip(`${waba.name} phone numbers`));
          write(`whatsapp/${waba.id}-numbers.json`, numbers);
          const templates = await list(
            `/${waba.id}/message_templates`,
            { fields: 'id,name,status,category,language,components,rejected_reason' },
            token,
          ).catch(skip(`${waba.name} templates`));
          write(`whatsapp/${waba.id}-templates.json`, templates);
        }
      }
      // Chats themselves never come through the API — only a webhook sees a
      // message, and only when it arrives. The chat history lives in the
      // WhatsApp app's own "export chat".
    },
  },
  ads: {
    permissions: ['ads_read'],
    async run(token, write) {
      const accounts = await list(
        '/me/adaccounts',
        { fields: 'id,name,account_status,currency,amount_spent,business' },
        token,
      );
      write('ads/accounts.json', accounts);
      for (const account of accounts) {
        const campaigns = await list(
          `/${account.id}/campaigns`,
          { fields: 'id,name,status,objective,start_time,stop_time,daily_budget,lifetime_budget' },
          token,
        ).catch(skip(`${account.name} campaigns`));
        write(`ads/${account.id}-campaigns.json`, campaigns);
        const insights = await list(
          `/${account.id}/insights`,
          {
            fields: 'date_start,date_stop,spend,impressions,reach,clicks,cpc,ctr,actions',
            date_preset: 'last_90d',
            time_increment: 'monthly',
          },
          token,
        ).catch(skip(`${account.name} insights`));
        write(`ads/${account.id}-insights-90d.json`, insights);
      }
    },
  },
};

const token =
  process.env.META_ACCESS_TOKEN || (await ask('Meta access token (not shown): ', { hidden: true }));
if (!token) {
  console.log('no token given');
  process.exit(1);
}

const out = outputDir('meta', args.out);
const write = (name, data) => {
  writeJson(out, name, data);
  console.log(`  ${name}${Array.isArray(data) ? ` (${data.length})` : ''}`);
};

if (args.path) {
  const path = String(args.path).startsWith('/') ? String(args.path) : `/${args.path}`;
  const name = `${path.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'root'}.json`;
  try {
    const first = await node(path, { fields: args.fields, limit: args.limit }, token);
    write(
      name,
      Array.isArray(first.data)
        ? await list(path, { fields: args.fields, limit: args.limit }, token)
        : first,
    );
  } catch (error) {
    console.log(`${path}: ${describe(error)}`);
    process.exitCode = 1;
  }
} else {
  const wanted =
    String(args.what ?? 'all') === 'all'
      ? Object.keys(PRESETS)
      : String(args.what)
          .split(',')
          .map((part) => part.trim())
          .filter(Boolean);
  for (const name of wanted) {
    const preset = PRESETS[name];
    if (!preset) {
      console.log(`unknown part "${name}" — known: ${Object.keys(PRESETS).join(', ')}`);
      continue;
    }
    console.log(`${name}:`);
    try {
      await preset.run(token, write);
    } catch (error) {
      console.log(`  failed — ${describe(error)}`);
      if (preset.permissions.length)
        console.log(
          `  this part needs the permissions: ${preset.permissions.join(', ')} (add them in the Explorer and generate the token again)`,
        );
      process.exitCode = 1;
    }
  }
}
console.log(`\nwritten to ${out}`);

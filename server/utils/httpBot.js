import { load as cheerioLoad } from "cheerio"; // For parsing HTML

import { createHttpClient } from "./clientUtils.js";
import { randomInteger } from "./randomUtils.js";

export default class HTTPBot {
  constructor({
    proxy = null,
    userAgent = "Mozilla/5.0",
    headers = {},
    followRedirects = true,
    responseCallback = null,
  } = {}) {
    this.visitedUrls = new Set(); // To avoid revisiting the same URL multiple times
    this.running = false;

    // Default headers
    this.defaultHeaders = {
      "User-Agent": userAgent,
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.5",
      "Accept-Encoding": "gzip, deflate, br",
      Connection: "keep-alive",
      ...headers, // Override default headers if custom headers are passed
    };

    // Create Axios instance with optional proxy and cookie handling
    this.axiosInstance = createHttpClient({
      headers: this.defaultHeaders,
      proxy,
      timeout: 10000,
      maxRedirects: followRedirects ? 5 : 0,
      validateStatus: (status) => {
        return status < 500;
      },
    });

    this.cookies = {}; // Store cookies from responses
    this.responseCallback = responseCallback;
  }

  // Main function that starts the cycle
  startCycle(url) {
    this.running = true;
    this.runCycle(url);
  }

  // Perform the cycle recursively with setTimeout to avoid blocking
  async runCycle(url) {
    if (!this.running) return; // Exit if the bot is not running

    const runNextCycle = async () => {
      // Wait for a random time between 2 to 10 seconds before starting the next cycle
      const randomWait = randomInteger(2000, 10000);
      await this.sleep(randomWait);

      // Start the next cycle
      this.runCycle(url);
    };

    try {
      // Perform a GET request to the main URL
      const mainResponse = await this.getRequest(url, true);
      if (!mainResponse) {
        runNextCycle();
        return;
      }

      const $ = cheerioLoad(mainResponse.data);

      // Get all assets (CSS, JS, IMG)
      const assets = this.getAssets($, url);

      // Download all assets
      for (let asset of assets) {
        await this.getRequest(asset);
      }

      // Get all <a> links and make GET requests to each one with a delay
      const links = this.getLinks($, url);
      const linkPromises = links.map((link) => this.getRequest(link));

      // Wait for all links to be processed
      await Promise.all(linkPromises);

      // Run the next cycle
      runNextCycle();
    } catch (err) {
      if (this.responseCallback) {
        this.responseCallback(err);
      }
    }
  }

  // Makes a GET request with Axios and handles errors
  async getRequest(url, bypassAlreadyVisited = false) {
    if (!bypassAlreadyVisited) {
      if (this.visitedUrls.has(url)) {
        // console.log(`Skipping already visited URL: ${url}`);
        return;
      }

      this.visitedUrls.add(url);
    }

    try {
      // console.log(`Requesting: ${url}`);
      const response = await this.axiosInstance.get(url);
      if (this.responseCallback) {
        this.responseCallback();
      }

      // Handle cookies from response headers
      this.handleCookies(response.headers["set-cookie"]);

      // Wait between 2 to 5 seconds after each request
      await this.sleep(randomInteger(100, 1000));
      return response;
    } catch (error) {
      if (this.responseCallback) {
        this.responseCallback(error);
      }
    }
  }

  // Handle cookies by storing them and attaching them to future requests
  handleCookies(setCookieHeader) {
    if (setCookieHeader) {
      setCookieHeader.forEach((cookie) => {
        const cookieParts = cookie.split(";")[0]; // Get the cookie before the first ';'
        const [cookieName, cookieValue] = cookieParts.split("=");
        this.cookies[cookieName] = cookieValue;
      });

      // Add the cookies to the headers for the next request
      this.axiosInstance.defaults.headers["Cookie"] = Object.entries(
        this.cookies
      )
        .map(([key, value]) => `${key}=${value}`)
        .join("; ");
    }
  }

  // Extracts all assets (CSS, JS, IMG) from the HTML
  getAssets($, target) {
    let assets = [];
    $('link[rel="stylesheet"], script[src], img[src]').each((i, el) => {
      const src = $(el).attr("href") || $(el).attr("src");
      if (src) assets.push(src);
    });

    // Normalize assets by target
    assets = assets.map((asset) => {
      if (asset.startsWith("../")) {
        asset = asset.slice(3);
      }

      if (asset.startsWith("./")) {
        asset = asset.slice(2);
      }

      if (asset.startsWith("/")) {
        asset = asset.slice(1);
      }

      if (asset.includes("://")) return asset;
      return `${target}/${asset}`;
    });

    return assets;
  }

  // Extracts all <a> links to make GET requests to each one
  getLinks($, target) {
    let links = [];
    $("a[href]").each((i, el) => {
      const href = $(el).attr("href");
      if (href) links.push(href);
    });

    // Normalize links by target
    links = links.map((link) => {
      if (link.startsWith("../")) {
        link = link.slice(3);
      }

      if (link.startsWith("./")) {
        link = link.slice(2);
      }

      if (link.startsWith("/")) {
        link = link.slice(1);
      }

      if (link.includes("://")) return link;
      return `${target}/${link}`;
    });

    return links;
  }

  // Function to wait for a random amount of time
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Stop the cycle
  stopCycle() {
    this.running = false;
  }
}

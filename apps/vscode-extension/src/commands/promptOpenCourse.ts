import * as vscode from "vscode";
import { githubRawCourseJsoncUrl } from "../workspace/chapterConfigDownload.ts";
import {
  fetchRemoteText,
  isAbortError,
  loadOfficialCourses,
  type OfficialCourseChoice,
} from "../workspace/officialCourses.ts";

/** Options for the Open Course picker. */
export interface PromptOpenCourseOptions {
  /** Development host prefills the local demo `course.jsonc` path. */
  isDevHost: boolean;
  /** Value placed in the picker. Confirming it opens that path or URL. */
  defaultCourseUrl?: string;
  /** Receives catalog failures. */
  output: vscode.OutputChannel;
}

/** Outcome of loading the official course list into an already open picker. */
type LoadOfficialCoursesResult =
  | { status: "ok"; courses: OfficialCourseChoice[] }
  | { status: "failed" }
  | { status: "cancelled" };

/** Course URL chosen in the Open Course picker, plus a downloaded `course.jsonc` when one was fetched. */
export interface OpenCourseSelection {
  courseRepoUrl: string;
  /** Raw `course.jsonc` downloaded before the picker closed. Chapter JSONC is not included. */
  courseJsoncText?: string;
}

/** QuickPick row that opens one official course's `course.jsonc`. */
interface CourseQuickPickItem extends vscode.QuickPickItem {
  courseJsoncUrl: string;
  courseJsoncText?: string;
}

/** Official course row, or a non-selectable separator. */
type OpenCoursePickItem = CourseQuickPickItem | vscode.QuickPickItem;

/**
 * Asks which course to open: an official catalog entry, or a typed path or URL.
 *
 * The picker is shown immediately and stays busy until each remote `course.jsonc` download
 * finishes. Chapter JSONC files are not downloaded here. Confirming a typed path or URL
 * opens that course directly. Dismissing the picker returns `undefined`.
 *
 * @param options - Dev-host prefill and the output channel
 * @returns Chosen course, or `undefined` when dismissed
 */
export async function promptOpenCourseUrl(
  options: PromptOpenCourseOptions,
): Promise<OpenCourseSelection | undefined> {
  return showOpenCoursePicker(options);
}

/**
 * Shows the Open Course picker at once and fills official courses when the catalog arrives.
 *
 * Confirming the picker's text opens that path or URL. A remote `course.jsonc` URL
 * keeps the picker busy until that file downloads. Closing the picker aborts the download.
 *
 * @param options - Dev-host prefill and the output channel
 * @returns Chosen course, or `undefined` when dismissed
 */
function showOpenCoursePicker(
  options: PromptOpenCourseOptions,
): Promise<OpenCourseSelection | undefined> {
  const abort = new AbortController();
  const configAbort = new AbortController();
  const pick = vscode.window.createQuickPick<OpenCoursePickItem>();
  pick.title = vscode.l10n.t("LearnByDiff: Open Course");
  pick.placeholder = vscode.l10n.t("LearnByDiff: loading official courses");
  pick.value = options.defaultCourseUrl ?? "";
  pick.matchOnDescription = true;
  pick.ignoreFocusOut = true;
  pick.busy = true;
  pick.items = openCoursePickItems([]);

  return new Promise((resolve) => {
    let settled = false;
    let downloadingConfig = false;

    /**
     * Closes the picker and returns `result` once.
     *
     * @param result - Chosen course, or `undefined` when dismissed
     */
    function finish(result: OpenCourseSelection | undefined): void {
      if (settled) {
        return;
      }
      settled = true;
      abort.abort();
      configAbort.abort();
      pick.hide();
      resolve(result);
    }

    /**
     * Opens the highlighted official course, or the typed path or URL.
     *
     * A GitHub `course.jsonc` URL that is not already downloaded keeps this picker
     * busy until that file arrives. Chapter JSONC files are not requested.
     */
    function acceptPick(): void {
      if (downloadingConfig) {
        return;
      }
      const typed = pick.value.trim();
      const selected = pick.activeItems[0];
      if (selected !== undefined && isCoursePick(selected) && typedSelectsCourse(typed, selected)) {
        acceptCourseUrl(selected.courseJsoncUrl, selected.courseJsoncText);
        return;
      }
      if (typed !== "") {
        acceptCourseUrl(typed);
      }
    }

    /**
     * Accepts `courseRepoUrl`, downloading its `course.jsonc` first when it is a remote GitHub file.
     *
     * @param courseRepoUrl - Official course URL or typed path
     * @param courseJsoncText - Config already downloaded for a listed course
     */
    function acceptCourseUrl(courseRepoUrl: string, courseJsoncText?: string): void {
      if (courseJsoncText !== undefined) {
        finish({ courseRepoUrl, courseJsoncText });
        return;
      }
      const rawUrl = githubRawCourseJsoncUrl(courseRepoUrl);
      if (rawUrl === undefined) {
        finish({ courseRepoUrl });
        return;
      }
      downloadingConfig = true;
      pick.busy = true;
      pick.enabled = false;
      pick.placeholder = vscode.l10n.t("Downloading course config…");
      void downloadCourseConfig(rawUrl, courseRepoUrl);
    }

    /**
     * Downloads one remote `course.jsonc` and then closes the picker.
     *
     * Leaves the picker open when the download fails so the URL can be corrected.
     *
     * @param rawUrl - raw.githubusercontent.com URL of `course.jsonc`
     * @param courseRepoUrl - URL to open after the download
     */
    async function downloadCourseConfig(rawUrl: string, courseRepoUrl: string): Promise<void> {
      try {
        const text = await fetchRemoteText(rawUrl, configAbort.signal);
        if (settled) {
          return;
        }
        if (text === undefined) {
          showConfigDownloadFailed();
          return;
        }
        finish({ courseRepoUrl, courseJsoncText: text });
      } catch (error) {
        if (settled || isAbortError(error)) {
          return;
        }
        const message = error instanceof Error ? error.message : String(error);
        options.output.appendLine(message);
        showConfigDownloadFailed();
      }
    }

    /**
     * Stops the course-config spinner and lets the student correct the URL.
     */
    function showConfigDownloadFailed(): void {
      downloadingConfig = false;
      pick.busy = false;
      pick.enabled = true;
      pick.placeholder = vscode.l10n.t(
        "Could not download course.jsonc. Check the URL and try again.",
      );
    }

    /**
     * Treats a hide that was not an accept as cancel and aborts in-flight downloads.
     */
    function hidePick(): void {
      if (!settled) {
        settled = true;
        abort.abort();
        configAbort.abort();
        resolve(undefined);
      }
      pick.dispose();
    }

    /**
     * Fills the open picker when the catalog request finishes.
     *
     * @param result - Courses, a failure, or cancellation
     */
    function applyCatalog(result: LoadOfficialCoursesResult): void {
      if (settled || result.status === "cancelled") {
        return;
      }
      pick.busy = false;
      if (result.status === "failed") {
        pick.placeholder = vscode.l10n.t(
          "Could not load the official course list. Enter a course.jsonc path or URL instead.",
        );
        return;
      }
      pick.placeholder = courseInputPrompt(options);
      pick.items = openCoursePickItems(result.courses);
    }

    pick.onDidAccept(acceptPick);
    pick.onDidHide(hidePick);
    pick.show();
    void loadOfficialCoursesForPicker(options, abort.signal).then(applyCatalog);
  });
}

/**
 * Downloads the official catalog unless `signal` is already aborted.
 *
 * @param options - Output channel for a catalog failure
 * @param signal - Aborted when the picker closes
 */
async function loadOfficialCoursesForPicker(
  options: PromptOpenCourseOptions,
  signal: AbortSignal,
): Promise<LoadOfficialCoursesResult> {
  if (signal.aborted) {
    return { status: "cancelled" };
  }
  /**
   * Downloads one official-repo file, aborting when the picker closes.
   *
   * @param url - Raw file URL
   */
  function fetchCatalogFile(url: string): Promise<string | undefined> {
    return fetchRemoteText(url, signal);
  }
  try {
    const courses = await loadOfficialCourses(fetchCatalogFile);
    if (signal.aborted) {
      return { status: "cancelled" };
    }
    return { status: "ok", courses };
  } catch (error) {
    if (signal.aborted || isAbortError(error)) {
      return { status: "cancelled" };
    }
    const message = error instanceof Error ? error.message : String(error);
    options.output.appendLine(message);
    return { status: "failed" };
  }
}

/**
 * Returns the placeholder that describes a typed course path or URL.
 *
 * @param options - Dev host uses the prefilled demo-path hint
 */
function courseInputPrompt(options: PromptOpenCourseOptions): string {
  return options.isDevHost
    ? vscode.l10n.t(
        "Path to course.jsonc (prefilled with local examples/demo-course/.course-config/course.jsonc)",
      )
    : vscode.l10n.t(
        "Path to course.jsonc, a GitHub course.jsonc URL, or a git URL to a course repository",
      );
}

/**
 * Builds the Open Course QuickPick rows from the official courses loaded so far.
 *
 * @param courses - Courses resolved so far; empty while the catalog request is in flight
 */
function openCoursePickItems(courses: readonly OfficialCourseChoice[]): OpenCoursePickItem[] {
  if (courses.length === 0) {
    return [];
  }
  return [
    { label: vscode.l10n.t("Official courses"), kind: vscode.QuickPickItemKind.Separator },
    ...courses.map(toOfficialCoursePick),
  ];
}

/**
 * Maps one official course to a selectable QuickPick row.
 *
 * @param course - Resolved catalog course
 */
function toOfficialCoursePick(course: OfficialCourseChoice): CourseQuickPickItem {
  return {
    label: course.title,
    description: course.id,
    courseJsoncUrl: course.courseJsoncUrl,
    courseJsoncText: course.courseJsoncText,
    iconPath: new vscode.ThemeIcon("mortar-board"),
  };
}

/**
 * Returns whether a QuickPick row is an official course.
 *
 * @param item - Highlighted Open Course row
 */
function isCoursePick(item: OpenCoursePickItem): item is CourseQuickPickItem {
  return "courseJsoncUrl" in item;
}

/**
 * Returns whether `typed` is choosing `course` rather than a custom path or URL.
 *
 * An empty value means the highlighted course. Other text counts only when it
 * appears in that course's title or id, which is how the picker filters rows.
 *
 * @param typed - Current picker text
 * @param course - Highlighted official course
 */
function typedSelectsCourse(typed: string, course: CourseQuickPickItem): boolean {
  if (typed === "") {
    return true;
  }
  const needle = typed.toLowerCase();
  const description = course.description ?? "";
  return course.label.toLowerCase().includes(needle) || description.toLowerCase().includes(needle);
}

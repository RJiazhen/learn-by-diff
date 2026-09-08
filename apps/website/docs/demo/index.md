---
title: Demo: Cursor particles
outline: deep
---

# Demo: Cursor particles

You will build a **full-screen dark canvas**: particles drift, gather into a ring around the cursor, then pick up a glow and a short trail.

This is the sample course in the repo. Chapter pages on this site match the snapshot docs in `examples/demo-source` (`README.md` or `docs.md`). Chapter 1’s course `docs` URL points here; later chapters open the files inside the snapshot.

|           |                                                                                                                                                        |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Course    | Cursor particles                                                                                                                                       |
| Config    | [`examples/demo-course/.course-config/course.yml`](https://github.com/RJiazhen/learn-by-diff/blob/main/examples/demo-course/.course-config/course.yml) |
| Snapshots | [`examples/demo-source`](https://github.com/RJiazhen/learn-by-diff/tree/main/examples/demo-source)                                                     |
| Chapters  | 4: skeleton → particles → follow → glow                                                                                                                |

<p class="lbd-quiet-link">
  <a href="/intro/start">New to the extension? Start here</a>
</p>

After cloning [learn-by-diff](https://github.com/RJiazhen/learn-by-diff), pick this file in Open Course:

```text
examples/demo-course/.course-config/course.yml
```

Do not use the whole product repository git URL as the course `url` (the repo root is not the course root).

## Chapters

| Chapter                           | Snapshot docs                    | What you get                                           |
| --------------------------------- | -------------------------------- | ------------------------------------------------------ |
| [Canvas skeleton](/demo/skeleton) | `skeleton/README.md`             | Full-window dark canvas, cleared every frame           |
| [Particles](/demo/particles)      | `particles/README.md`            | Dots that wrap at the edges                            |
| [Follow the cursor](/demo/follow) | `follow/README.md`               | Hollow ring around the pointer; scatter when it leaves |
| [Glow and trails](/demo/glow)     | `glow/docs.md` (also `docs.pdf`) | Steady glow + short trail                              |

## Tips

- **Read the diff first, then follow the chapter page.**
- Serve `index.html` over any static server (ES modules need `http://`).
- To run a reference tree, use the chapter’s reference folder. Do not click **Not Started / Completed** unless you mean to overwrite the main workspace.

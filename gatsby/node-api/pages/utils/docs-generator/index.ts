import { ContentLoader } from "./contentLoader";
import {
  ContentGQL,
  DocsContent,
  DocsContentItem,
  DocsContentDocs,
  DocsNavigationTopic,
} from "./types";
import { extractContent } from "./extractContent";
import { loadManifest } from "./loadManifest";

import { resolve } from "path";

import { Specification } from "@typings/docs";
import { readYaml } from "../../../../../tools/content-loader/src/helpers";
import to from "await-to-js";
import { ClusterDocsTopic } from "../../../../../tools/content-loader/src/cdt-serializer/types";
import { readFileSync } from "fs-extra";
import { safeLoad } from "js-yaml";

const contentLoader = new ContentLoader();

export const docsGenerator = <T extends ContentGQL>(
  contentGQLs: T[],
  folder: string,
  extractFn: (
    doc: T,
    docsGroup: string,
    topicId: string,
  ) => DocsContentDocs | null,
  version?: string,
) => {
  const navigation: DocsNavigationTopic[] = [];

  const documents = contentGQLs.filter(
    val => val.fields.docInfo.version === version,
  );

  const nodeContent = [] as ContentGQL[];

  documents.forEach(item => {
    if (item.fields.slug.endsWith("index.md")) {
      nodeContent.push(item);
    } else {
      const filePath = item.fields.slug.replace(".md", "") as string;
      const navigationPath = filePath.split("/");
      addChildren(navigation, navigationPath, item);
    }
  });

  nodeContent.forEach(item => {
    const filePath = item.fields.slug.replace("/index.md", "") as string;
    const navigationPath = filePath.split("/");
    markNodeWithContent(navigation, navigationPath);
  });

  const newBetterContent = {
    component: {},
  } as DocsContent;

  documents.forEach(content => {
    const tmpObj = {} as DocsContentItem;
    const id = content.fields.slug.replace(".md", "");
    tmpObj.id = id;
    tmpObj.displayName = content.frontmatter.title;
    tmpObj.type = "component";

    const tmpDoc = {} as DocsContentDocs;
    tmpDoc.order = content.fields.slug;
    tmpDoc.title = content.frontmatter.title;
    tmpDoc.source = content.rawMarkdownBody;
    tmpDoc.imagesSpec = content.fields.imagesSpec;
    tmpDoc.type = "";

    tmpObj.docs = [tmpDoc];
    tmpObj.specifications = [] as Specification[];

    newBetterContent.component[id] = tmpObj;
  });

  //TODO: hack for fixing links, it should be removed and fixed in normal way
  navigation.forEach(val => {
    val.id = "component/" + val.id;
  });

  return {
    content: newBetterContent,
    navigation,
    manifest: navigation,
  };
};

export const addChildren = <T extends ContentGQL>(
  navigation: DocsNavigationTopic[],
  navigationPath: string[],
  item: T,
): void => {
  if (navigationPath.length === 0) {
    return;
  }

  let found: boolean = false;
  navigation.forEach(navigationItem => {
    if (navigationPath[0] === navigationItem.id) {
      addChildren(navigationItem.children, navigationPath.slice(1), item);
      found = true;
      return;
    }
  });
  if (found) {
    return;
  }

  let displayName = "";
  if (navigationPath.length === 1) {
    displayName = item.frontmatter.title;
  } else {
    const path = item.fileAbsolutePath.split("/");
    const dirPath = path.slice(0, path.length - 1);
    dirPath.push("metadata.yaml");

    const metadataPath = dirPath.join("/");

    const file = readFileSync(resolve(metadataPath)).toString();
    const data = safeLoad(file) as DirMetadata;

    displayName = data.displayName;
  }

  // create if not found
  const newDocsNavigationTopic = {
    id: navigationPath[0],
    displayName,
    children: [] as DocsNavigationTopic[],
    noContent: true,
  } as DocsNavigationTopic;

  addChildren(newDocsNavigationTopic.children, navigationPath.slice(1), item);

  // add child
  navigation.push(newDocsNavigationTopic);
};

export type DocsGeneratorReturnType = ReturnType<typeof docsGenerator>;

export const markNodeWithContent = (
  navigation: DocsNavigationTopic[],
  filePath: string[],
): void => {
  navigation.forEach(navigationItem => {
    if (navigationItem.id === filePath[0]) {
      if (filePath.length === 1) {
        navigationItem.noContent = false;
      } else {
        markNodeWithContent(navigationItem.children, filePath.slice(1));
      }
    }
  });
};

export interface DirMetadata {
  displayName: string;
}

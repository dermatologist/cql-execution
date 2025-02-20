import { ValueSet } from '../datatypes/datatypes';

/*
 * Lookup of all codes used based on their ValueSet
 */
export interface ValueSetDictionary {
  [oid: string]: {
    [version: string]: {
      code: string;
      system: string;
      version?: string;
      display?: string;
    }[];
  };
}

/*
 * Lookup of ValueSet objects
 */
export interface ValueSetObject {
  [oid: string]: {
    [version: string]: ValueSet;
  };
}

/*
 * Structure of an implementation to look up ValueSets based on oid and version
 */
export interface TerminologyProvider {
  findValueSetsByOid: (oid: string) => ValueSet[] | Promise<ValueSet[]>;
  findValueSet: (oid: string, version?: string) => ValueSet | Promise<ValueSet> | null;
}

/*
  * Structure of a service that can check an assertion using the LLM
*/
export interface LlmService {
  checkAssertion: (expression: string, context: string) => Promise<boolean>;
  checkMention: (expression: string, context: string) => Promise<boolean>;
  checkNegation: (expression: string, context: string) => Promise<boolean>;
}
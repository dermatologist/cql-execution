import { MessageListener, NullMessageListener } from './messageListeners';
import { Results } from './results';
import { UnfilteredContext, PatientContext } from './context';
import { DateTime } from '../datatypes/datetime';
import { Parameter } from '../types/runtime.types';
import { DataProvider, LlmService, TerminologyProvider } from '../types';

export class Executor {
  constructor(
    public library: any,
    public codeService?: TerminologyProvider,
    public parameters?: Parameter,
    public messageListener: MessageListener = new NullMessageListener(),
    public llmService?: LlmService
  ) {}

  withLibrary(lib: any) {
    this.library = lib;
    return this;
  }

  withParameters(params: Parameter) {
    this.parameters = params != null ? params : {};
    return this;
  }

  withCodeService(cs: TerminologyProvider) {
    this.codeService = cs;
    return this;
  }

  withMessageListener(ml: MessageListener) {
    this.messageListener = ml;
    return this;
  }

  async exec_expression(expression: any, patientSource: DataProvider, executionDateTime: DateTime) {
    const r = new Results();
    const expr = this.library.expressions[expression];
    if (expr != null) {
      // NOTE: Using await to support async data providers whose implementations return promise
      // await has no effect on functions that don't return promises, so it is safe to use in all cases
      let currentPatient = await patientSource.currentPatient();
      while (currentPatient) {
        const patient_ctx = new PatientContext(
          this.library,
          currentPatient,
          this.codeService,
          this.parameters,
          executionDateTime,
          this.messageListener
        );
        r.recordPatientResults(patient_ctx, { [expression]: expr.execute(patient_ctx) });
        currentPatient = await patientSource.nextPatient();
      }
    }
    return r;
  }

  async exec(patientSource: DataProvider, executionDateTime?: DateTime) {
    const r = await this.exec_patient_context(patientSource, executionDateTime);
    const unfilteredContext = new UnfilteredContext(
      this.library,
      r,
      this.codeService,
      this.parameters,
      executionDateTime,
      this.messageListener
    );
    const resultMap: any = {};
    for (const key in this.library.expressions) {
      const expr = this.library.expressions[key];
      if (expr.context === 'Unfiltered') {
        resultMap[key] = await expr.exec(unfilteredContext);
      }
    }
    r.recordUnfilteredResults(resultMap);
    return r;
  }

  async exec_patient_context(patientSource: DataProvider, executionDateTime?: DateTime) {
    const r = new Results();

    // NOTE: Using await to support async data providers whose implementations return promise
    // await has no effect on functions that don't return promises, so it is safe to use in all cases
    let currentPatient = await patientSource.currentPatient();
    while (currentPatient) {
      const patient_ctx = new PatientContext(
        this.library,
        currentPatient,
        this.codeService,
        this.parameters,
        executionDateTime,
        this.messageListener
      );
      const resultMap: any = {};
      for (const key in this.library.expressions) {
        const expr = this.library.expressions[key];
        if (expr.context === 'Patient') {
          resultMap[key] = await expr.execute(patient_ctx);
        }
        //! START: Process with LLM if DocumentReference
        /*
          * expr
          {
            "name": "HasRecentVisualFootExam",
            "context": "Patient",
            "expression": {
              "arg": {
                "sources": [
                  {
                    "alias": "P",
                    "expression": {
                      "datatype": "{http://hl7.org/fhir}DocumentReference",
                      "templateId": "http://hl7.org/fhir/StructureDefinition/DocumentReference",
                      "codeProperty": "code",
                      "codes": {
                        "source": {
                          "name": "Diabetic foot examination (regime/therapy)"
                        },
                        "path": "codes"
                      }
                    }
                  }
                ],
                "aliases": [
                  "P"
                ],
                "letClauses": [],
                "relationship": [],
                "where": {
                  "args": [
                    {
                      "args": [
                        {
                          "source": {
                            "scope": "P",
                            "path": "status"
                          },
                          "path": "value"
                        },
                        {
                          "valueType": "{urn:hl7-org:elm-types:r1}String",
                          "value": "completed"
                        }
                      ]
                    },
                    {
                      "args": [
                        {
                          "args": [
                            {
                              "source": {
                                "arg": {
                                  "scope": "P",
                                  "path": "performed"
                                },
                                "asTypeSpecifier": {
                                  "name": "{http://hl7.org/fhir}dateTime",
                                  "type": "NamedTypeSpecifier"
                                },
                                "strict": false
                              },
                              "path": "value"
                            },
                            {
                              "lowClosed": true,
                              "highClosed": true,
                              "low": {
                                "args": [
                                  {},
                                  {
                                    "value": 1,
                                    "unit": "year"
                                  }
                                ]
                              },
                              "high": {
                                "args": [
                                  {},
                                  {
                                    "value": 1,
                                    "unit": "year"
                                  }
                                ]
                              }
                            }
                          ]
                        },
                        {
                          "arg": {
                            "arg": {}
                          }
                        }
                      ]
                    }
                  ]
                },
                "returnClause": null,
                "aggregateClause": null,
                "sortClause": null
              }
            }
          }

          * context
          [
            {
              "clinicalStatus": {
                "coding": [
                  {
                    "system": {
                      "value": "http://terminology.hl7.org/CodeSystem/condition-clinical"
                    },
                    "code": {
                      "value": "active"
                    },
                    "display": {
                      "value": "Active"
                    }
                  }
                ]
              },
              "verificationStatus": {
                "coding": [
                  {
                    "system": {
                      "value": "http://terminology.hl7.org/CodeSystem/condition-ver-status"
                    },
                    "code": {
                      "value": "confirmed"
                    },
                    "display": {
                      "value": "Confirmed"
                    }
                  }
                ]
              },
              "code": {
                "coding": [
                  {
                    "system": {
                      "value": "http://snomed.info/sct"
                    },
                    "code": {
                      "value": "44054006"
                    },
                    "display": {
                      "value": "Diabetes mellitus type 2 (disorder)"
                    }
                  }
                ]
              },
              "subject": {
                "reference": {
                  "value": "Patient/Recent_Foot_Exam"
                }
              },
              "onset": {
                "value": "2015-01-30"
              },
              "id": {
                "value": "2-1"
              }
            }
          ]
    */
        try{
          const expression = JSON.stringify(expr);
          const context = JSON.stringify(await currentPatient.findRecords("DocumentReference"));
          const source = expr.expression.arg.sources[0].expression.datatype;
          if (source.includes('DocumentReference')) {
            if (this.llmService) {
              const result = await this.llmService.checkAssertion(expression, context);
              resultMap[key] = result;
            }
          }
        } catch (e) {
        }
        /*
        {
          "Patient": {
            "gender": {
              "value": "female"
            },
            "birthDate": {
              "value": "1979-01-30"
            },
            "id": {
              "value": "Recent_Foot_Exam"
            }
          },
          "InDemographic": true,
          "HasDiabetes": false,
          "MeetsInclusionCriteria": false,
          "HasRecentVisualFootExam": true
        }
        */
        //! END: Process with LLM if DocumentReference
      }
      r.recordPatientResults(patient_ctx, resultMap);
      currentPatient = await patientSource.nextPatient();
    }
    return r;
  }
}

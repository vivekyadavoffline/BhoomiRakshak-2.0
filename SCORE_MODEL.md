# Score Model

Bhoomi Rakshak uses several related scores. They should not be treated as interchangeable.

## Priority Score

The priority score ranks a community for action:

`Priority score = hazard intensity x exposure x vulnerability / normalization`

The prototype stores the normalized result in each zone's `priorityScore` field, on a `0-100` scale.

It appears in:

- Ranked red-zone list
- 2D map marker labels
- Selected-zone detail panel
- Phasing matrix
- Analytics chart
- Legal certificate
- Citizen local-risk summary
- Guided demo output

Priority phases are:

- `Immediate`: urgent structural or life-safety concern
- `Short-Term`: recurring or increasing risk that needs preparation
- `Medium-Term`: gradual or projected risk requiring monitoring and planning

## Multi-Hazard Composite Risk

The risk-map Fusion Analysis panel calculates a composite score from the currently enabled hazard layers:

`Composite risk = average(active hazard risks) + fusion overlap bonus`

The score is capped at `100`.

Risk levels are:

- `Safe`: below `35`
- `Moderate`: `35-59`
- `High`: `60-79`
- `Critical`: `80-100`

The panel also shows each individual hazard percentage and the number of overlapping hazards.

## Relocation Site Suitability

Suitability evaluates the proposed destination across eight factors:

- Hazard safety
- Carrying capacity
- Road accessibility
- Water availability
- Healthcare access
- Education access
- Livelihood continuity
- Distance from the affected habitation

`Suitability score = average of the eight factor scores`

Recommendations are:

- `Highly Suitable`: `80-100`
- `Suitable with Improvements`: `60-79`
- `Not Suitable`: below `60`

The suitability score and factor breakdown appear in the selected-zone detail panel.

## Disaster History

The planning view also records prior events for each zone. History is shown as:

- Number of recorded events
- Latest event description
- Severity
- History risk percentage

History should be treated as supporting evidence for the priority and composite-risk decisions, not as a replacement for current hazard data.

## Prototype Data Note

The current frontend records are synthetic planning data for demonstration. Production deployment should replace them with verified hazard, census, event-history, and site-assessment datasets.

import * as helpers from '%{ cb "/js/helpers.js" }%';

import NationPreferencesDialog from '%{ cb "/js/nation_preferences_dialog.js" }%';

export default class CreateGameDialog extends React.Component {
	constructor(props) {
		super(props);
		this.state = {
			open: false,
			variant: Globals.variants.find(v => {
				return v.Properties.Name == "Classical";
			}),
			newGameProperties: {
				Variant: "Classical",
				NationAllocation: 0,
				PhaseLengthMinutes: 1440,
				NonMovementPhaseLengthMinutes: 0,
				Desc: Globals.user.GivenName + "'s game",
				Private: false,
				Anonymous: false,
				LastYear: 0,
				MinReliability: Math.min(
					10,
					Math.floor(Globals.userStats.Properties.Reliability)
				),
				MinQuickness: 0,
				MinRating: 0,
				MaxRating: 0,
				MaxHated: 0,
				MaxHater: 0,
				DisableConferenceChat: false,
				DisableGroupChat: false,
				DisablePrivateChat: false
			},
			userStats: Globals.userStats,
			samePhaseLength: true,
			nonMovementPhaseLengthUnit: 60 * 24,
			nonMovementPhaseLengthMultiplier: 1,
			phaseLengthUnit: 60 * 24,
			phaseLengthMultiplier: 1
		};
		this.close = this.close.bind(this);
		this.createGame = this.createGame.bind(this);
		this.createGameWithPreferences = this.createGameWithPreferences.bind(
			this
		);
		this.setPhaseLength = this.setPhaseLength.bind(this);
		this.setNonMovementPhaseLength = this.setNonMovementPhaseLength.bind(
			this
		);
		this.newGamePropertyUpdater = this.newGamePropertyUpdater.bind(this);
		this.checkboxField = this.checkboxField.bind(this);
		this.floatField = this.floatField.bind(this);
		this.validators = [];
		this.resetValidators = this.resetValidators.bind(this);
		if (this.props.parentCB) {
			this.props.parentCB(this);
		}
		this.nationPreferencesDialog = null;
	}
	resetValidators() {
		this.validators = [
			props => {
				if (
					props.LastYear != 0 &&
					props.LastYear <
						this.state.variant.Properties.Start.Year + 1
				) {
					return (
						"Last year must be 0, or greater than or equal to " +
						(this.state.variant.Properties.Start.Year + 1) +
						"."
					);
				}
				return null;
			}
		];
	}
	componentDidUpdate(prevProps, prevState, snapshot) {
		if (
			JSON.stringify(Globals.userStats) !=
			JSON.stringify(this.state.userStats)
		) {
			this.setState((state, props) => {
				state = Object.assign({}, state);
				state.userStats = Globals.userStats;
				state.newGameProperties.MinReliability = Math.min(
					10,
					Math.floor(Globals.userStats.Properties.Reliability)
				);
				return state;
			});
		}
		if (!prevState.open && this.state.open) {
			gtag("set", {
				page_title: "CreateGameDialog",
				page_location: location.href
			});
			gtag("event", "page_view");
		}
	}
	close() {
		return new Promise((res, rej) => {
			helpers.unback(this.close);
			this.setState({ open: false }, res);
		});
	}
	createGame() {
		if (this.state.newGameProperties.NationAllocation == 1) {
			this.nationPreferencesDialog.setState({
				open: true,
				nations: this.state.variant.Properties.Nations,
				onSelected: preferences => {
					this.createGameWithPreferences(preferences);
				}
			});
		} else {
			this.createGameWithPreferences([]);
		}
	}
	createGameWithPreferences(preferences) {
		let invalids = [];
		this.validators.forEach(validator => {
			let validation = validator(this.state.newGameProperties);
			if (validation) {
				invalids.push(validation);
			}
		});
		if (invalids.length > 0) {
			helpers.snackbar(invalids.join("<br/>"));
			return;
		}
		const newGameProps = Object.assign({}, this.state.newGameProperties);
		newGameProps.FirstMember = {
			NationPreferences: preferences.join(",")
		};
		helpers.incProgress();
		helpers
			.safeFetch(
				helpers.createRequest("/Game", {
					method: "POST",
					headers: {
						"Content-Type": "application/json"
					},
					body: JSON.stringify(newGameProps)
				})
			)
			.then(resp => {
				helpers.decProgress();
				gtag("event", "create_game");
				Globals.messaging.start();
				this.close().then(this.props.gameCreated);
			});
	}
	newGamePropertyUpdater(propertyName, opts = {}) {
		return ev => {
			ev.persist();
			this.setState((state, props) => {
				state = Object.assign({}, state);
				if (ev.target.type == "checkbox") {
					if (propertyName == "Private") {
						state.newGameProperties["MinReliability"] = ev.target
							.checked
							? 0
							: Math.min(
									10,
									Math.floor(
										this.state.userStats.Properties
											.Reliability
									)
							  );
					}
					state.newGameProperties[propertyName] = opts.invert
						? !ev.target.checked
						: ev.target.checked;
				} else {
					let newValue = ev.target.value;
					if (opts.float && newValue != "") {
						newValue = Number.parseFloat(ev.target.value);
						if (opts.max && opts.max < newValue) {
							helpers.snackbar(
								propertyName +
									" must be lower than or equal to " +
									opts.max +
									"."
							);
							newValue = opts.max;
						}
						if (opts.min && newValue != 0 && opts.min > newValue) {
							helpers.snackbar(
								propertyName +
									" must be 0, or greater than or equal to " +
									opts.min +
									"."
							);
						}
					}
					if (opts.int && newValue != "") {
						newValue = Number.parseInt(ev.target.value);
						if (opts.min && newValue != 0 && opts.min > newValue) {
							helpers.snackbar(
								propertyName +
									" must be 0, or greater than or equal to " +
									opts.min +
									"."
							);
						}
					}
					state.newGameProperties[propertyName] = newValue;
				}
				state.variant = Globals.variants.find(v => {
					return v.Properties.Name == state.newGameProperties.Variant;
				});
				return state;
			});
		};
	}
	floatField(name, opts = {}) {
		this.validators.push(properties => {
			if (properties[name] == "") {
				properties[name] = 0;
			}
			properties[name] = Number.parseFloat(properties[name]);
			if (properties[name] != 0) {
				if (opts.max && opts.max < properties[name]) {
					return (
						name +
						" must be lower than or equal to " +
						opts.max +
						"."
					);
				}
				if (opts.min && opts.min > properties[name]) {
					return (
						name +
						" must be 0, or greater than or equal to " +
						opts.min +
						"."
					);
				}
			}
			return null;
		});
		opts.float = true;
		return (
			<MaterialUI.TextField
				type="number"
				fullWidth
				label={opts.label || name}
				margin="dense"
				value={this.state.newGameProperties[name]}
				onChange={this.newGamePropertyUpdater(name, opts)}
			/>
		);
	}
	setNonMovementPhaseLength(ev) {
		ev.persist();
		this.setState((state, props) => {
			state = Object.assign({}, state);
			if (ev.target.name == "non-movement-phase-length-unit") {
				state.nonMovementPhaseLengthUnit = ev.target.value;
				state.newGameProperties["NonMovementPhaseLengthMinutes"] =
					state.nonMovementPhaseLengthUnit *
					state.nonMovementPhaseLengthMultiplier;
			} else if (
				ev.target.name == "non-movement-phase-length-multiplier"
			) {
				state.nonMovementPhaseLengthMultiplier = ev.target.value;
				state.newGameProperties["NonMovementPhaseLengthMinutes"] =
					state.nonMovementPhaseLengthUnit *
					state.nonMovementPhaseLengthMultiplier;
			} else if (ev.target.name == "same-phase-length") {
				if (ev.target.checked) {
					state.newGameProperties[
						"NonMovementPhaseLengthMinutes"
					] = 0;
					state.samePhaseLength = true;
				} else {
					state.newGameProperties["NonMovementPhaseLengthMinutes"] =
						state.nonMovementPhaseLengthUnit *
						state.nonMovementPhaseLengthMultiplier;
					state.samePhaseLength = false;
				}
			}
			return state;
		});
	}
	setPhaseLength(ev) {
		ev.persist();
		this.setState((state, props) => {
			state = Object.assign({}, state);
			if (ev.target.name == "phase-length-unit") {
				state.phaseLengthUnit = ev.target.value;
			} else if (ev.target.name == "phase-length-multiplier") {
				state.phaseLengthMultiplier = ev.target.value;
			}
			state.newGameProperties["PhaseLengthMinutes"] =
				state.phaseLengthUnit * state.phaseLengthMultiplier;
			return state;
		});
	}
	checkboxField(name, opts = {}) {
		return (
			<MaterialUI.FormControlLabel
				control={
					<MaterialUI.Checkbox
						checked={
							opts.invert
								? !this.state.newGameProperties[name]
								: this.state.newGameProperties[name]
						}
						onChange={this.newGamePropertyUpdater(name, opts)}
					/>
				}
				label={opts.label || name}
			/>
		);
	}

	render() {
		this.resetValidators();
		return (
			<React.Fragment>
				<MaterialUI.Dialog
					onEntered={helpers.genOnback(this.close)}
					open={this.state.open}
					disableBackdropClick={false}
					onClose={this.close}
					fullScreen
				>
					        <MaterialUI.AppBar>
          <MaterialUI.Toolbar>
            <MaterialUI.IconButton
              edge="start"
              color="inherit"
              onClick={this.close}
              aria-label="close"
            >
              {helpers.createIcon("\ue5cd")}
            </MaterialUI.IconButton>
            <MaterialUI.Typography variant="h6" style={{ paddingLeft: "16px" }}>
              Create new game
            </MaterialUI.Typography>
          </MaterialUI.Toolbar>
        </MaterialUI.AppBar>


  <div style={{maxWidth:"920px", margin: "auto"}} >
  <div style={{margin:"72px 16px 0px 16px"}}>
						<div id="step1">
						<MaterialUI.TextField
							key="Desc"
							label="Name"
							margin="dense"
							fullWidth
							value={this.state.newGameProperties["Desc"]}
							onChange={this.newGamePropertyUpdater("Desc")}
							style={{marginBottom: "16px"}}
						/>

						  <MaterialUI.InputLabel shrink id="variantlabel">
          Variant
        </MaterialUI.InputLabel>
						<MaterialUI.Select
							key="Variant"
							labelId="variantlabel"
							fullWidth
							value={this.state.newGameProperties["Variant"]}
							onChange={this.newGamePropertyUpdater("Variant")}
							style={{marginBottom: "16px"}}
						>
							{console.log(Globals)}
							{console.log(this.state)}
							{Globals.variants.map(variant => {
								return (
									<MaterialUI.MenuItem
										key={variant.Properties.Name}
										value={variant.Properties.Name}
									>
										{variant.Properties.Name} {" ("}
										{variant.Properties.Nations.length}{" "}
										players)
									</MaterialUI.MenuItem>
								);
							})}
						</MaterialUI.Select>


						<MaterialUI.Typography style={{paddingBottom: "4px"}} variant="body2">{this.state.variant.Properties.Description}</MaterialUI.Typography>
						<img src={this.state.variant.Links[3].URL} style={{paddingBottom:"16px", maxHeight: "300px"}} />


						<MaterialUI.Typography style={{paddingBottom: "16px"}} variant="body2">{this.state.variant.Properties.Rules}</MaterialUI.Typography>



						<MaterialUI.Select
							key="NationAllocation"
							fullWidth
							value={
								this.state.newGameProperties["NationAllocation"]
							}
							onChange={this.newGamePropertyUpdater(
								"NationAllocation"
							)}
						>
							<MaterialUI.MenuItem key={0} value={0}>
								Random nation allocation
							</MaterialUI.MenuItem>
							<MaterialUI.MenuItem key={1} value={1}>
								Preference based nation allocation
							</MaterialUI.MenuItem>
						</MaterialUI.Select>

						</div>
						</div>






						<MaterialUI.Box
							display="flex"
							justifyContent="space-between"
							key="PhaseLengthMinutes"
						>
							<MaterialUI.TextField
								name="phase-length-multiplier"
								label="Phase duration"
								type="number"
								margin="dense"
								inputProps={{ min: 0 }}
								value={this.state.phaseLengthMultiplier}
								onChange={this.setPhaseLength}
							/>
							<MaterialUI.Select
								name="phase-length-unit"
								value={this.state.phaseLengthUnit}
								onChange={this.setPhaseLength}
							>
								<MaterialUI.MenuItem key={1} value={1}>
									Minutes
								</MaterialUI.MenuItem>
								<MaterialUI.MenuItem key={60} value={60}>
									Hours
								</MaterialUI.MenuItem>
								<MaterialUI.MenuItem
									key={60 * 24}
									value={60 * 24}
								>
									Days
								</MaterialUI.MenuItem>
							</MaterialUI.Select>
						</MaterialUI.Box>
						<MaterialUI.FormControlLabel
							key="samePhaseLength"
							control={
								<MaterialUI.Checkbox
									name="same-phase-length"
									checked={this.state.samePhaseLength}
									onChange={this.setNonMovementPhaseLength}
								/>
							}
							label="Same length for all phases"
						/>
						{this.state.samePhaseLength ? (
							""
						) : (
							<MaterialUI.Box
								display="flex"
								justifyContent="space-between"
								key="NonMovementPhaseLengthMinutes"
							>
								<MaterialUI.TextField
									name="non-movement-phase-length-multiplier"
									label="Non movement phase duration"
									type="number"
									margin="dense"
									inputProps={{ min: 0 }}
									value={
										this.state
											.nonMovementPhaseLengthMultiplier
									}
									onChange={this.setNonMovementPhaseLength}
								/>
								<MaterialUI.Select
									name="non-movement-phase-length-unit"
									value={
										this.state.nonMovementPhaseLengthUnit
									}
									onChange={this.setNonMovementPhaseLength}
								>
									<MaterialUI.MenuItem key={1} value={1}>
										Minutes
									</MaterialUI.MenuItem>
									<MaterialUI.MenuItem key={60} value={60}>
										Hours
									</MaterialUI.MenuItem>
									<MaterialUI.MenuItem
										key={60 * 24}
										value={60 * 24}
									>
										Days
									</MaterialUI.MenuItem>
								</MaterialUI.Select>
							</MaterialUI.Box>
						)}
						<MaterialUI.Typography>
							Start year{" "}
							{this.state.variant.Properties.Start.Year}
						</MaterialUI.Typography>
						<MaterialUI.TextField
							type="number"
							fullWidth
							label="End after year (e.g. 1908) (0 = off)"
							margin="dense"
							value={this.state.newGameProperties.LastYear}
							onChange={this.newGamePropertyUpdater("LastYear", {
								int: true,
								min:
									this.state.variant.Properties.Start.Year + 1
							})}
						/>
						<MaterialUI.FormGroup>
							{this.checkboxField("Private")}
							{this.checkboxField("DisableConferenceChat", {
								invert: true,
								label: "Conference chat"
							})}
							{this.checkboxField("DisableGroupChat", {
								invert: true,
								label: "Group chat"
							})}
							{this.checkboxField("DisablePrivateChat", {
								invert: true,
								label: "Private chat"
							})}
							<MaterialUI.FormControlLabel
								control={
									<MaterialUI.Checkbox
										disabled={
											!this.state.newGameProperties[
												"Private"
											]
										}
										checked={
											this.state.newGameProperties[
												"Private"
											]
												? this.state.newGameProperties[
														"Anonymous"
												  ]
												: this.state.newGameProperties[
														"DisableConferenceChat"
												  ] &&
												  this.state.newGameProperties[
														"DisableGroupChat"
												  ] &&
												  this.state.newGameProperties[
														"DisablePrivateChat"
												  ]
										}
										onChange={this.newGamePropertyUpdater(
											"Anonymous"
										)}
									/>
								}
								label="Anonymous"
							/>
						</MaterialUI.FormGroup>
						{this.floatField("MinReliability", {
							label: "Minimum reliability, high = active players",
							max: Math.floor(
								this.state.userStats.Properties.Reliability
							)
						})}
						{this.floatField("MinQuickness", {
							label: "Minimum quickness, high = fast games",
							max: Math.floor(
								this.state.userStats.Properties.Quickness
							)
						})}
						{this.floatField("MinRating", {
							label: "Minimum rating, high = strong players",
							max: Math.floor(
								this.state.userStats.Properties.TrueSkill.Rating
							)
						})}
						{this.floatField("MaxRating", {
							label: "Maximum rating, low = weak players",
							min: Math.ceil(
								this.state.userStats.Properties.TrueSkill.Rating
							)
						})}
						{this.floatField("MaxHated", {
							label: "Maximum hated, low = unbanned players",
							min: Math.ceil(
								this.state.userStats.Properties.Hated
							)
						})}
						{this.floatField("MaxHater", {
							label: "Maximum hater, low = patient players",
							min: Math.ceil(
								this.state.userStats.Properties.Hater
							)
						})}
							<MaterialUI.Button
								onClick={this.createGame}
								color="primary"
							>
								Create
							</MaterialUI.Button>
						</div>
				</MaterialUI.Dialog>
				<NationPreferencesDialog
					parentCB={c => {
						this.nationPreferencesDialog = c;
					}}
					onSelected={null}
				/>
			</React.Fragment>
		);
	}
}

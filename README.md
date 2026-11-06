# generic: A Generic Drug Price Checker

## Description

**generic** is a web app that helps people judge a cash price they were quoted for a prescription drug. You search for a drug, enter quantity and the price the pharmacy quoted, and the app shows how that price compares with what pharmacies themselves pay for the drug. It also charts how that cost has changed over time, and if you created an account, you can save quotes and come back to them later.

<!--TODO:add the live link once the app is deployed-->

## The problem

Drug prices are hard to judge. A pharmacy might quote $20 for 30 tablets of a generic drug, and most people have no idea whether that's reasonable. Pharmacy apps show what a pharmacy charges, but not what the drug costs pharmacy.

The second number does exist. CMS, the federal agency that runs Medicaid, publishes the **National Average Drug Acquisition Cost (NADAC)**. NADAC is the average price survey of pharmacies pay to buy each drug, and CMS updates it weekly from a national survey of pharmacy invoices. The data is public, but it's published as a CSV with over a million rows, which is not something a patient can use. This project turns that file into a search box and a calculator.

## Features

- **Drug search:** search by name, for example "lisinopril", with a paginated results showing each drug's NDC, pricing unit, and current NADAC price and date.
- **Price history:** Clicking a drug draws constructs and display a line chart of the drug's NADAC price
- **Quote comparison:** enter a quantity and a quoted price to see the NADAC total, the difference and the markup percentage.
- **Accounts:** register, log in and log out.
- **Saved quotes:** logged-in users can save comparisons, list them, edit them, and delete them. Each saved quote is recalculated against current NADAC price whenever it is viewed.

## How it works

## API endpoints

## Files

## Design choices

## Running it locally

## Acknowledgements

- Data: CMS, National Average Drug Acquisition Cost

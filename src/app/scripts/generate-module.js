const fs = require('fs');
const path = require('path');

const MODULES_DIR = path.join(__dirname, '../modules');

const generateModule = moduleName => {
  if (!moduleName) {
    console.error('Please provide a module name!');
    process.exit(1);
  }

  const modulePath = path.join(MODULES_DIR, moduleName);

  if (fs.existsSync(modulePath)) {
    console.error(`Module '${moduleName}' already exists!`);
    process.exit(1);
  }

  // Create module folder
  fs.mkdirSync(modulePath, { recursive: true });

  // Capitalize module name
  const capitalize = str => str.charAt(0).toUpperCase() + str.slice(1);

  const capitalizedModule = capitalize(moduleName);

  // Generate files
  const files = {
    controller: `
import httpStatus from 'http-status';
import sendResponse from '../../utils/sendResponse';
import catchAsync from '../../utils/catchAsync';
import { ${moduleName}Service } from './${moduleName}.service';

const create${capitalizedModule} = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await ${moduleName}Service.create${capitalizedModule}IntoDb(user.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: '${capitalizedModule} created successfully',
    data: result,
  });
});

const get${capitalizedModule}List = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await ${moduleName}Service.get${capitalizedModule}ListFromDb(user.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: '${capitalizedModule} list retrieved successfully',
    data: result,
  });
});

const get${capitalizedModule}ById = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await ${moduleName}Service.get${capitalizedModule}ByIdFromDb(user.id, req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: '${capitalizedModule} details retrieved successfully',
    data: result,
  });
});

const update${capitalizedModule} = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await ${moduleName}Service.update${capitalizedModule}IntoDb(user.id, req.params.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: '${capitalizedModule} updated successfully',
    data: result,
  });
});

const delete${capitalizedModule} = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await ${moduleName}Service.delete${capitalizedModule}ItemFromDb(user.id, req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: '${capitalizedModule} deleted successfully',
    data: result,
  });
});

export const ${moduleName}Controller = {
  create${capitalizedModule},
  get${capitalizedModule}List,
  get${capitalizedModule}ById,
  update${capitalizedModule},
  delete${capitalizedModule},
};
    `,

    service: `
import prisma from '../../utils/prisma';
import { UserRoleEnum, UserStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';


const create${capitalizedModule}IntoDb = async (userId: string, data: any) => {
  
    const result = await prisma.${moduleName}.create({ 
    data: {
      ...data,
      userId: userId,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, '${moduleName} not created');
  }
    return result;
};

const get${capitalizedModule}ListFromDb = async (userId: string) => {
  
    const result = await prisma.${moduleName}.findMany();
    if (result.length === 0) {
    return { message: 'No ${moduleName} found' };
  }
    return result;
};

const get${capitalizedModule}ByIdFromDb = async (userId: string, ${moduleName}Id: string) => {
  
    const result = await prisma.${moduleName}.findUnique({ 
    where: {
      id: ${moduleName}Id,
    }
   });
    if (!result) {
    throw new AppError(httpStatus.NOT_FOUND,'${moduleName} not found');
  }
    return result;
  };



const update${capitalizedModule}IntoDb = async (userId: string, ${moduleName}Id: string, data: any) => {
  
    const result = await prisma.${moduleName}.update({
      where:  {
        id: ${moduleName}Id,
        userId: userId,
    },
    data: {
      ...data,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, '${moduleName}Id, not updated');
  }
    return result;
  };

const delete${capitalizedModule}ItemFromDb = async (userId: string, ${moduleName}Id: string) => {
    const deletedItem = await prisma.${moduleName}.delete({
      where: {
      id: ${moduleName}Id,
      userId: userId,
    },
  });
  if (!deletedItem) {
    throw new AppError(httpStatus.BAD_REQUEST, '${moduleName}Id, not deleted');
  }

    return deletedItem;
  };

export const ${moduleName}Service = {
create${capitalizedModule}IntoDb,
get${capitalizedModule}ListFromDb,
get${capitalizedModule}ByIdFromDb,
update${capitalizedModule}IntoDb,
delete${capitalizedModule}ItemFromDb,
};
    `,

    routes: `
import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { ${moduleName}Controller } from './${moduleName}.controller';
import { ${moduleName}Validation } from './${moduleName}.validation';

const router = express.Router();

router.post(
'/',
auth(),
validateRequest(${moduleName}Validation.createSchema),
${moduleName}Controller.create${capitalizedModule},
);

router.get('/', auth(), ${moduleName}Controller.get${capitalizedModule}List);

router.get('/:id', auth(), ${moduleName}Controller.get${capitalizedModule}ById);

router.put(
'/:id',
auth(),
validateRequest(${moduleName}Validation.updateSchema),
${moduleName}Controller.update${capitalizedModule},
);

router.delete('/:id', auth(), ${moduleName}Controller.delete${capitalizedModule});

export const ${moduleName}Routes = router;
    `,

    validation: `
import { z } from 'zod';

const createSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required'),
    description: z.string().optional(),
    }),
});

const updateSchema = z.object({
  body: z.object({
    name: z.string().optional(),
    description: z.string().optional(),
    }),
});

export const ${moduleName}Validation = {
createSchema,
updateSchema,
};
    `,
  };

  for (const [key, content] of Object.entries(files)) {
    const filePath = path.join(modulePath, `${moduleName}.${key}.ts`);
    fs.writeFileSync(filePath, content.trim());
    console.log(`Created: ${filePath}`);
  }

  console.log(`Module '${moduleName}' created successfully!`);
};

// Run script
const [, , moduleName] = process.argv;
generateModule(moduleName);

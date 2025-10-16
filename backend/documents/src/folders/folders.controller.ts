import { Body, Controller, Get, Param, Post } from '@nestjs/common';

import { CreateFolderDto } from './dto/create-folder.dto';
import { FolderResponse } from './dto/folder-response.dto';
import { FindFolderParamsDto } from './dto/find-folder-params.dto';
import { FoldersService } from './folders.service';

@Controller('api/v1/folders')
export class FoldersController {
  constructor(private readonly foldersService: FoldersService) {}

  @Post()
  async create(@Body() dto: CreateFolderDto): Promise<FolderResponse> {
    return this.foldersService.create(dto);
  }

  @Get(':ownerType/:ownerId')
  findOne(@Param() params: FindFolderParamsDto): Promise<FolderResponse> {
    return this.foldersService.findByOwner(params.ownerType, params.ownerId);
  }
}
